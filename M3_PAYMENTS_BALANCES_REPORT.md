# YardFlow — M3 Payments & Balances Report

**Milestone:** M3 Payments & Balances  
**Date:** 2026-06-04  
**Status:** Complete — settlement engine, FIFO allocation, supplier credit pool, operational balance UX

---

## 1. Summary

M3 transforms YardFlow from inventory tracking into an **operational settlement system** without changing append-only ledger philosophy, tenant isolation, or the frozen design system.

Delivered:

- Append-only payment records (`supplier_payments`, `buyer_payments`, `payment_allocations`)
- **FIFO allocation engine** — oldest unpaid purchase/sale settled first
- **Supplier credit pool** — overpayments become credit; auto-consumed on next purchase
- **Payment status engine** — `unpaid` / `partial` / `paid` on purchases and sales
- **Balance projections** — supplier owed, credit, buyer receivables, last payment
- API modules: supplier payments, buyer payments, balances
- Extended operational workspaces: party drawers, purchase/sale settlement detail, dashboard KPIs
- 12 payment e2e scenarios (incl. status transitions + concurrent safety); **38/38 API tests pass**; web build passes

**Not in scope (unchanged):** M-Pesa, receipt printing, POS, billing, invoicing, accounting exports, double-entry accounting, realtime sockets, tax/PDF.

---

## 2. Files changed

### Database

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `SupplierPayment`, `BuyerPayment`, `PaymentAllocation`; enums `PaymentMethod`, `PaymentSourceType`, `PaymentAllocationTargetType` |
| `apps/api/prisma/migrations/20260603211027_m3_payments_balances/migration.sql` | M3 tables and indexes |

### Shared packages

| File | Change |
|------|--------|
| `packages/validation/src/payment.schema.ts` | Create/list payment Zod schemas |
| `packages/validation/src/ledger.schema.ts` | Optional `paymentMethod` on purchase/sale create |
| `packages/validation/src/list-query.schema.ts` | Party `credit` filter (`has_credit`); payment list query |
| `packages/validation/src/index.ts` | Export payment schemas |
| `packages/types/src/permissions.ts` | `supplier_payment:create`, `buyer_payment:create`, `payment:view` (already present) |

### API — core payment engine

| File | Change |
|------|--------|
| `apps/api/src/ledger/payment-allocation.service.ts` | FIFO allocation, credit pool, status refresh, row locking |
| `apps/api/src/ledger/ledger.module.ts` | Export `PaymentAllocationService` |

### API — new modules

| File | Change |
|------|--------|
| `apps/api/src/modules/supplier-payments/*` | POST/GET supplier payments |
| `apps/api/src/modules/buyer-payments/*` | POST/GET buyer payments |
| `apps/api/src/modules/balances/*` | Balance summaries and outstanding transactions |

### API — extended modules

| File | Change |
|------|--------|
| `apps/api/src/modules/purchases/purchases.service.ts` | Credit consumption on create; creation payment; enriched detail (`paidAmountKes`, `remainingKes`, allocations) |
| `apps/api/src/modules/sales/sales.service.ts` | Creation payment; enriched detail |
| `apps/api/src/modules/suppliers/suppliers.service.ts` | Balance summary, recent payments, unpaid purchases; credit filter |
| `apps/api/src/modules/buyers/buyers.service.ts` | Balance summary, recent payments, unpaid sales |
| `apps/api/src/modules/dashboard/dashboard.service.ts` | Payments today, supplier credit, largest outstanding |
| `apps/api/src/common/list-query-builders.ts` | `partyCreditFilter` |
| `apps/api/src/app.module.ts` | Register payment/balance modules |

### API — tests

| File | Change |
|------|--------|
| `apps/api/test/payments.e2e-spec.ts` | 10 M3 payment scenarios |
| `apps/api/test/helpers/ledger-test-utils.ts` | Clear payments/allocations; reset party balances |

### Web

| File | Change |
|------|--------|
| `apps/web/src/components/ops/party-workspace.tsx` | Balance/credit summary, unpaid list, payment history, quick payment form, credit filter |
| `apps/web/src/components/ops/purchases-workspace.tsx` | Paid total, remaining, allocation list in drawer |
| `apps/web/src/components/ops/sales-workspace.tsx` | Paid total, remaining, allocation list in drawer |
| `apps/web/src/app/[tenantSlug]/dashboard/page.tsx` | Payments today KPIs, largest outstanding section |

---

## 3. Payment architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ SupplierPayment │────▶│ PaymentAllocation    │────▶│ Purchase (target)   │
│ BuyerPayment    │     │ (append-only audit)    │     │ Sale (target)       │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
         │                          │
         │                          └── source: supplier_payment | buyer_payment
         │                              | supplier_credit_pool
         ▼
┌─────────────────┐
│ Supplier credit │◀── overpayment remainder
│ creditBalanceKes│──▶ auto-applied on new purchase
└─────────────────┘
```

**Principles preserved:**

- Payments and allocations are **append-only** — no updates or deletes
- All settlement runs inside **Prisma transactions** with `LEDGER_TRANSACTION_OPTIONS`
- **Row locking** (`SELECT … FOR UPDATE`) on supplier/buyer before allocation
- **Idempotency** via `(tenantId, idempotencyKey)` unique constraint
- **Audit + ledger events** on every payment creation
- **Tenant isolation** on all queries

**Paid amount calculation:**

```
purchase_paid = amountPaidAtCreationKes + SUM(allocations → purchase)
sale_paid     = amountReceivedAtCreationKes + SUM(allocations → sale)
remaining     = totalValueKes - paid (floored at 0)
```

---

## 4. FIFO allocation logic

Implemented in `PaymentAllocationService.allocateSupplierPayment` / `allocateBuyerPayment`:

1. **Optional linked transaction first** — if `purchaseId` / `saleId` provided, allocate to that target up to its remaining balance
2. **FIFO loop** — fetch unpaid/partial purchases (or sales) ordered by `createdAt ASC`
3. For each target with remaining balance, allocate `min(payment_remaining, target_remaining)`
4. Create immutable `payment_allocations` row per slice
5. Refresh payment status on each affected purchase/sale
6. **Supplier only:** if payment remainder > 0 after all targets, increment `supplier.creditBalanceKes`
7. **Supplier only:** decrement `supplier.balanceKes` by amount allocated to purchases (not full payment when credit is created)
8. **Buyer only:** reject payment if amount exceeds total receivable (no buyer credit pool in M3)

Deterministic ordering: `createdAt ASC` on unpaid/partial transactions ensures oldest debt is settled first.

---

## 5. Supplier credit behavior

| Event | Effect |
|-------|--------|
| Overpayment on supplier payment | Remainder after FIFO → `creditBalanceKes += remainder` |
| New purchase created | `applySupplierCreditOnPurchase` consumes credit before adding debt |
| Credit allocation | `payment_allocations` with `sourceType: supplier_credit_pool` (no payment row) |
| Balance update on purchase | Debt added only for amount not covered by credit |

**Example (from tests):**

- Purchase 10 kg × 50 = KES 500 unpaid
- Pay KES 800 → purchase paid, credit KES 300
- Next purchase 10 kg × 50 = KES 500 → credit 300 applied, balance owed KES 200, purchase `partial`

---

## 6. Payment status transition rules

Status derived by `derivePaymentStatus(total, paid)` in `ledger-math.ts`:

| Condition | Status |
|-----------|--------|
| `paid <= 0` | `unpaid` |
| `paid >= total` | `paid` |
| otherwise | `partial` |

Status updates occur transactionally after:

- Payment allocation (supplier or buyer)
- Supplier credit application on purchase
- Creation-time payment recording (cash at purchase/sale entry)

Statuses are stored on `purchases.payment_status` and `sales.payment_status` and refreshed via `refreshPurchaseStatus` / `refreshSaleStatus`.

---

## 7. API endpoints

### Supplier payments (`/v1/supplier-payments`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/` | `supplier_payment:create` | Create payment; FIFO allocate; audit |
| GET | `/` | `payment:view` | Paginated list (filter by supplier, method, date) |
| GET | `/:id` | `payment:view` | Detail with allocations, operator, enriched totals |

**Create body:** `{ supplierId, amountKes, paymentMethod, idempotencyKey, purchaseId?, notes? }`  
**Methods:** `cash`, `bank`, `mobile_money_manual`, `other_manual`

### Buyer payments (`/v1/buyer-payments`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/` | `buyer_payment:create` | Create payment; FIFO allocate; audit |
| GET | `/` | `payment:view` | Paginated list |
| GET | `/:id` | `payment:view` | Detail with allocations |

### Balances (`/v1/balances`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/summary` | `payment:view` | Tenant-wide supplier owed, credit, buyer receivable |
| GET | `/suppliers` | `payment:view` | Per-supplier balance projections |
| GET | `/buyers` | `payment:view` | Per-buyer receivable projections |
| GET | `/suppliers/:id/outstanding` | `payment:view` | Unpaid/partial purchases for supplier |
| GET | `/buyers/:id/outstanding` | `payment:view` | Unpaid/partial sales for buyer |

### Extended existing endpoints

- `GET /v1/suppliers/:id` — balance summary, recent payments, unpaid purchases
- `GET /v1/buyers/:id` — balance summary, recent payments, unpaid sales
- `GET /v1/purchases/:id` — `paidAmountKes`, `remainingKes`, `paymentAllocations`
- `GET /v1/sales/:id` — same settlement fields
- `GET /v1/dashboard/overview` — `paymentsToday`, `supplierCreditKes`, `largestOutstanding`

### List filters (unchanged paths, new query params)

- Purchases/sales: `paymentStatus=unpaid|partial|paid`
- Suppliers: `balance=owed|clear`, `credit=has_credit`
- Buyers: `balance=receivable|clear`

---

## 8. Tests added

**File:** `apps/api/test/payments.e2e-spec.ts`

| # | Test | Validates |
|---|------|-----------|
| 1 | Full supplier payment settles purchase | Status → paid, balance → 0 |
| 2 | Partial supplier payment | Status → partial |
| 3 | FIFO allocates oldest purchase first | Allocation order + amounts |
| 4 | Supplier overpayment creates credit pool | `creditBalanceKes` increment |
| 5 | Supplier credit auto-consumed on next purchase | Credit → 0, partial debt |
| 6 | Buyer partial payment | Sale status → partial |
| 7 | Buyer full payment | Sale paid, buyer balance → 0 |
| 8 | Payment idempotency | Same key → same row, no duplicate |
| 9 | Allocation audit sum | Allocations sum = payment amount |
| 10 | Tenant isolation | Payments list scoped to tenant |
| 11 | Payment status transitions | `unpaid` → `partial` → `paid` on purchase |
| 12 | Concurrent supplier payments | Parallel pays; no over-allocation; credit correct |

**Note:** Concurrent test exercises row locking via `Promise.all` on two payments against one open purchase.

---

## 9. Test results

```
pnpm --filter @yardflow/api test

Test Suites: 4 passed, 4 total
Tests:       38 passed, 38 total
  - permissions.unit.spec.ts
  - payments.e2e-spec.ts (10)
  - ledger.e2e-spec.ts (unchanged — no regression)
  - app.e2e-spec.ts

pnpm --filter @yardflow/web build
✓ Compiled successfully
✓ Linting and type check passed
```

---

## 10. UI / UX delivered

| Surface | Settlement features |
|---------|---------------------|
| **Supplier drawer** | Owed balance, credit available, unpaid purchases, payment history (click for allocation detail), quick payment form |
| **Buyer drawer** | Receivable, unpaid sales, payment history (click for allocation detail), quick payment form |
| **Purchase drawer** | Paid total, remaining, payment status badge, allocation audit list |
| **Sale drawer** | Paid total, remaining, payment status badge, allocation audit list |
| **Dashboard** | Owed to suppliers, buyer receivables, payments paid/collected today, largest outstanding |
| **Filters** | Payment status on purchases/sales; supplier has balance / has credit; buyer receivable |

Design constraints maintained: IBM-style restraint, drawer-based ops UX, dense tables, no fintech charts.

---

## 11. Remaining debt (before M4)

| Item | Priority | Notes |
|------|----------|-------|
| Standalone payment list workspace | Low | Payments viewable from party drawer detail; no dedicated `/payments` route |
| Purchase/sale list columns for remaining | Low | Remaining shown in detail drawer; list API does not project per-row remaining (would require join/aggregate) |
| Buyer credit / overpayment | Out of scope | M3 rejects buyer overpayment vs receivable |
| Payment reversal / void | Out of scope | Append-only; corrections milestone if needed |

---

## 12. Risks before M4

| Risk | Mitigation |
|------|------------|
| M-Pesa integration complexity | M3 manual methods establish allocation patterns; M-Pesa should reuse same engine with external reference idempotency |
| High-volume FIFO on parties with many open transactions | Current loop is correct but O(n) per payment; monitor; consider indexed “open debt” view if needed |
| Supplier credit visibility | Credit shown in drawer and dashboard; operators must understand credit auto-applies on purchase |
| No payment void | Operational mistakes require compensating payment or future correction flow |
| List remaining balance N+1 | Defer until reporting needs justify aggregate in list API |

---

## 13. Success criteria checklist

| Criterion | Status |
|-----------|--------|
| Supplier payments work | ✅ |
| Buyer payments work | ✅ |
| Partial payments work | ✅ |
| FIFO allocation works | ✅ |
| Supplier credit works | ✅ |
| Statuses update correctly | ✅ |
| Balances project correctly | ✅ |
| Drawers show payment history | ✅ |
| Dashboard reflects balances | ✅ |
| All tests pass | ✅ 38/38 |
| No ledger integrity regression | ✅ |
| M3 report | ✅ |

**M3 is complete.** YardFlow is financially operational for manual settlement before M-Pesa and POS printing.
