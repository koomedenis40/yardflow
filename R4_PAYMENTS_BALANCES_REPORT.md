# YardFlow — R4 Payments & Balances Report

**Milestone:** R4 Payments & Balances Rebuild  
**Date:** 2026-06-05  
**Base commit:** `44957f5` (R3)  
**Status:** Complete — manual settlement engine restored

---

## 1. Scope delivered

| In scope | Out of scope (later milestones) |
|----------|----------------------------------|
| Supplier payments (manual, confirmed) | M-Pesa |
| Buyer payments (manual, confirmed) | Receipts, CS30 printing |
| FIFO allocation engine | Web UI, mobile app |
| Supplier credit pool | Billing, Super Admin |
| Payment allocations (append-only) | Accounting exports |
| Balance projections & outstanding views | Payment reversal/void |

---

## 2. Files changed

### Database

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `SupplierPayment`, `BuyerPayment`, `PaymentAllocation`; `creditBalanceKes` on suppliers; enums `PaymentMethod`, `PaymentRecordStatus`, `PaymentSourceType`, `PaymentAllocationTargetType` |
| `apps/api/prisma/migrations/20260605160000_r4_payments_balances/migration.sql` | R4 tables, indexes, supplier credit column |

### Shared packages

| File | Change |
|------|--------|
| `packages/types/src/enums.ts` | R4 manual `PAYMENT_METHOD`; `PAYMENT_SOURCE_TYPE` |
| `packages/validation/src/payments.ts` | `createSupplierPaymentSchema`, `createBuyerPaymentSchema` (already present; used by R4) |
| `packages/validation/src/enums.ts` | Manual methods = all R4 methods |

### API — settlement engine

| File | Change |
|------|--------|
| `apps/api/src/ledger/payment-allocation.service.ts` | FIFO allocation, credit pool, status refresh, row locking |
| `apps/api/src/ledger/ledger-math.ts` | `derivePaymentStatus`, `remainingKes` |
| `apps/api/src/ledger/exceptions.ts` | `BuyerOverpaymentException` → 422 |
| `apps/api/src/ledger/ledger-transaction.service.ts` | Auto-apply supplier credit on purchase create |
| `apps/api/src/ledger/ledger.module.ts` | Export `PaymentAllocationService` |

### API — new modules

| File | Change |
|------|--------|
| `apps/api/src/supplier-payments/*` | POST/GET supplier payments |
| `apps/api/src/buyer-payments/*` | POST/GET buyer payments |
| `apps/api/src/balances/*` | Summary, per-party balances, outstanding transactions |

### API — extended modules

| File | Change |
|------|--------|
| `apps/api/src/suppliers/*` | `GET :id` with balance, credit, unpaid purchases, recent payments |
| `apps/api/src/buyers/*` | `GET :id` with receivable, unpaid sales, recent payments |
| `apps/api/src/purchases/purchases.service.ts` | Enriched detail: `paidAmountKes`, `remainingKes`, allocations |
| `apps/api/src/sales/sales.service.ts` | Same settlement fields |
| `apps/api/src/app.module.ts` | Register payment/balance modules |

### Tests

| File | Change |
|------|--------|
| `apps/api/test/payments.e2e-spec.ts` | 15 payment/settlement scenarios |
| `apps/api/test/helpers/ledger-test-utils.ts` | `createSupplierPayment`, `createBuyerPayment` helpers |

---

## 3. Schema additions

| Model | Table | Purpose |
|-------|-------|---------|
| `SupplierPayment` | `supplier_payments` | Append-only supplier settlement; idempotency per tenant |
| `BuyerPayment` | `buyer_payments` | Append-only buyer settlement |
| `PaymentAllocation` | `payment_allocations` | Immutable audit of how each payment/credit slice was applied |
| `Supplier.creditBalanceKes` | `suppliers.credit_balance_kes` | Unallocated advance (projection) |

**Payment methods:** `cash`, `bank`, `mobile_money_manual`, `other_manual`  
**Payment record status:** `pending`, `confirmed`, `failed`, `reversed` (R4 manual → `confirmed` immediately)  
**Allocation sources:** `supplier_payment`, `buyer_payment`, `supplier_credit_pool`

---

## 4. Settlement architecture

```
SupplierPayment / BuyerPayment (confirmed)
        │
        ▼
PaymentAllocationService (transaction + row locks)
        │
        ├─ lock supplier/buyer (SELECT … FOR UPDATE)
        ├─ optional linked purchase/sale first
        ├─ FIFO loop (createdAt ASC)
        ├─ append payment_allocations rows
        ├─ refresh purchase/sale paymentStatus
        ├─ update party balanceKes (+ creditBalanceKes for supplier overpay)
        ├─ ledger_events + audit_logs
        └─ idempotency replay (no duplicate allocations)
```

**Principles:** Append-only payments and allocations; tenant-scoped queries; ReadCommitted + row locks.

---

## 5. FIFO logic

1. If `purchaseId` / `saleId` provided → allocate to that target first (up to remaining).
2. Fetch unpaid/partial purchases (or sales) for party ordered by `createdAt ASC`.
3. For each target: `slice = min(payment_remaining, target_remaining)`.
4. Create `payment_allocations` row per slice.
5. Refresh `payment_status` on each affected purchase/sale.

---

## 6. Supplier credit behavior

| Event | Effect |
|-------|--------|
| Overpayment after FIFO | Remainder → `creditBalanceKes += remainder` |
| New purchase | `applySupplierCreditOnPurchase` consumes credit first |
| Credit allocation | `payment_allocations` with `sourceType: supplier_credit_pool` |
| Balance on purchase | Debt added for full total; credit application reduces `balanceKes` |

**Example:** Pay KES 800 on KES 500 purchase → paid + KES 300 credit. Next KES 500 purchase → KES 300 credit applied, KES 200 owed, status `partial`.

---

## 7. Buyer payment behavior

- FIFO allocation to oldest unpaid/partial sales.
- **Overpayment rejected** if `amountKes > buyer.balanceKes` → **422 `BUYER_OVERPAYMENT_NOT_ALLOWED`**.
- No buyer credit pool in R4.
- `balanceKes` decremented by full confirmed payment amount.

---

## 8. Payment status rules

`derivePaymentStatus(total, paid)`:

| Condition | Status |
|-----------|--------|
| `paid <= 0` | `unpaid` |
| `paid >= total` | `paid` |
| otherwise | `partial` |

Refreshed after allocations and supplier credit application on purchase.

---

## 9. Balance projections

| Endpoint | Returns |
|----------|---------|
| `GET /v1/balances/summary` | `supplierOwedKes`, `supplierCreditKes`, `buyerReceivableKes` |
| `GET /v1/balances/suppliers` | Per-supplier `balanceKes`, `creditBalanceKes` |
| `GET /v1/balances/buyers` | Per-buyer `balanceKes` |
| `GET /v1/balances/suppliers/:id/outstanding` | Unpaid/partial purchases with `paidAmountKes`, `remainingKes` |
| `GET /v1/balances/buyers/:id/outstanding` | Unpaid/partial sales with settlement fields |

---

## 10. API endpoints

### Supplier payments (`/v1/supplier-payments`)

| Method | Permission | Description |
|--------|------------|-------------|
| POST | `supplier_payment:create` | Create + FIFO allocate |
| GET | `payment:view` | List (tenant-scoped) |
| GET `/:id` | `payment:view` | Detail + allocations |

### Buyer payments (`/v1/buyer-payments`)

| Method | Permission | Description |
|--------|------------|-------------|
| POST | `buyer_payment:create` | Create + FIFO allocate |
| GET | `payment:view` | List |
| GET `/:id` | `payment:view` | Detail + allocations |

### Extended detail endpoints

- `GET /v1/suppliers/:id` — balance, credit, unpaid purchases, recent payments
- `GET /v1/buyers/:id` — receivable, unpaid sales, recent payments
- `GET /v1/purchases/:id` — `paidAmountKes`, `remainingKes`, `allocations`
- `GET /v1/sales/:id` — same settlement fields

---

## 11. Tests

**Total API tests: 47** (4 unit + 13 foundation + 15 ledger + 15 payments)

| # | Scenario | File |
|---|----------|------|
| 1 | Full supplier payment settles purchase | `payments.e2e-spec.ts` |
| 2 | Partial supplier payment | `payments.e2e-spec.ts` |
| 3 | FIFO supplier allocation | `payments.e2e-spec.ts` |
| 4 | Supplier overpayment → credit | `payments.e2e-spec.ts` |
| 5 | Credit auto-consumed on purchase | `payments.e2e-spec.ts` |
| 6 | Buyer partial payment | `payments.e2e-spec.ts` |
| 7 | Buyer full payment | `payments.e2e-spec.ts` |
| 8 | Buyer overpayment rejected | `payments.e2e-spec.ts` |
| 9 | Status transitions unpaid→partial→paid | `payments.e2e-spec.ts` |
| 10 | Payment idempotency | `payments.e2e-spec.ts` |
| 11 | Allocation audit sums | `payments.e2e-spec.ts` |
| 12 | Tenant isolation | `payments.e2e-spec.ts` |
| 13 | Concurrent supplier payments | `payments.e2e-spec.ts` |
| 14 | Balances summary | `payments.e2e-spec.ts` |
| 15 | Purchase/sale detail paid+remaining | `payments.e2e-spec.ts` |
| + | R3 ledger tests (no regression) | `ledger.e2e-spec.ts` |
| + | R2 foundation tests | `app.e2e-spec.ts` |

---

## 12. Commands run

```powershell
cd C:\dev\yardflow-rebuild
pnpm -r build
pnpm --filter @yardflow/api test
cd apps\api
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec prisma db seed
```

All passed.

---

## 13. Known limitations

- **Manual methods only** — all R4 payments confirm immediately; no M-Pesa pending flow.
- **No payment reversal** — append-only; mistakes need compensating payment (future correction flow).
- **No creation-time cash on purchase/sale** — settlement via separate payment endpoints only.
- **Buyer credit / overpayment** — rejected; no advance pool for buyers.
- **List endpoints** — purchases/sales lists do not project per-row `remainingKes` (detail only).
- **FIFO O(n)** — correct but linear per payment; monitor at high open-debt volume.

---

## 14. Next milestone recommendation

**R5 — Web operational UI** (or next planned recovery step): Rebuild supplier/buyer drawers, purchase/sale settlement detail, dashboard KPIs, and quick payment forms on top of the R4 API — without M-Pesa or receipts yet. Alternatively **R5 — M-Pesa** if payment rails are prioritized before UI.

Goal: Operators can settle manually via API; web/mobile surfaces can now bind to stable settlement endpoints.
