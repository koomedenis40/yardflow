# YardFlow — M2 Core Ledger Report

**Milestone:** M2 Core Ledger  
**Date:** 2026-06-03  
**Status:** Complete — API ledger, e2e tests, and minimal web UI

---

## 1. Scope delivered

| In scope | Out of scope (later milestones) |
|----------|----------------------------------|
| Suppliers, buyers CRUD | M-Pesa, payment allocations |
| Purchases, sales (append-only) | Receipts, billing |
| Stock balances, movements | POS offline queue |
| Weighted-average COGS on sales | Reports, exports |
| Corrections (purchase/sale) | Supplier FIFO credit |
| Stock adjustments (owner) | |

---

## 2. Database changes

**Migration:** `apps/api/prisma/migrations/20260603140332_m2_core_ledger`

| Table | Purpose |
|-------|---------|
| `suppliers` | Party owed balance (`balance_kes`) |
| `buyers` | Customer receivable balance |
| `purchases` | Inbound stock; idempotency per tenant |
| `sales` | Outbound stock; COGS + gross profit snapshot |
| `stock_balances` | Per-tenant/category weight + `avg_cost_per_kg` |
| `stock_movements` | Append-only audit trail |
| `corrections` | Post-hoc weight/value fixes |
| `stock_adjustments` | Physical count deltas |
| `ledger_events` | Domain event log |

**Enums:** `PaymentStatus`, `CorrectableType`, `StockMovementType`

---

## 3. Locking and concurrency strategy

1. **Tenant scope** — All queries use `tenantId` from JWT only.
2. **Row lock** — `StockLedgerService.lockStockBalance()` runs `SELECT … FOR UPDATE` on `stock_balances` before any stock change.
3. **Oversell** — `assertSufficientStock()` throws **409 Conflict** when sale weight exceeds locked balance.
4. **Isolation** — Ledger writes use **ReadCommitted** + row locks (`LEDGER_TRANSACTION_OPTIONS` in `ledger-transaction.ts`). Serializable was dropped after concurrent e2e showed spurious PostgreSQL `40001` errors instead of clean 409 responses.
5. **Idempotency** — Unique `(tenant_id, idempotency_key)` on purchases and sales; replay returns the original row without double stock effect.

Purchases and sales run in a single Prisma transaction: lock → validate → write document → `applyStockDelta` → party balance update → `ledger_events` → audit log.

---

## 4. API modules

| Module | Routes (prefix `/v1`) |
|--------|------------------------|
| `suppliers` | CRUD list/get/create/update |
| `buyers` | CRUD list/get/create/update |
| `purchases` | POST create, GET list, GET `:id` |
| `sales` | POST create, GET list, GET `:id` |
| `inventory` | GET balances, GET movements |
| `inventory/adjustments` | POST adjust, GET list |
| `corrections` | POST create, GET list |
| `ledger` | `StockLedgerService`, `LedgerEventsService`, `ledger-math.ts` |

**Shared validation:** `packages/validation/src/ledger.schema.ts` (Zod).

---

## 5. Web (minimal M2 UI)

New routes under `apps/web/src/app/[tenantSlug]/`:

| Page | Permission-gated nav |
|------|---------------------|
| `/suppliers` | `supplier:view` |
| `/buyers` | `buyer:view` |
| `/purchases` | `purchase:view` / `purchase:create` form |
| `/sales` | `sale:view` / `sale:create` form |
| `/inventory` | `inventory:view` |

Reusable components: `party-list-page.tsx`, `ledger-transaction-page.tsx`. Nav updated in `tenant-shell.tsx`.

---

## 6. Tests

**File:** `apps/api/test/ledger.e2e-spec.ts`  
**Helpers:** `apps/api/test/helpers/ledger-test-utils.ts`

| Test | Result |
|------|--------|
| Purchase increases stock | Pass |
| Sale reduces stock | Pass |
| Oversell blocked (409) | Pass |
| Weighted average COGS | Pass |
| Idempotency duplicate purchase | Pass |
| Cashier cannot create correction | Pass |
| Cashier cannot create adjustment | Pass |
| Correction blocked if negative stock (422) | Pass |
| Owner stock adjustment | Pass |
| Tenant isolation on purchase get | Pass |
| Concurrent sales cannot oversell | Pass |

**Full API suite:** `26 passed` (11 M1 e2e + 11 M2 ledger e2e + 4 unit permission tests).

```powershell
cd "c:\Users\User\Desktop\Clients\My Projects\yardflow\apps\api"
pnpm test
```

---

## 7. Commands and verification

| Command | Notes |
|---------|--------|
| `pnpm test` (api) | **26/26 pass** with Postgres on port **5434** |
| `pnpm exec nest build` (api) | Pass (with dev server running) |
| `pnpm build` (root) | May fail with `EPERM` on Prisma engine if `pnpm dev` holds the DLL — stop dev, then run full build |

Local DB (see `M1_DB_FIX_REPORT.md`):

```text
DATABASE_URL=postgresql://yardflow:yardflow@127.0.0.1:5434/yardflow?schema=public
```

**Demo login:** `owner@demo.local` / `cashier@demo.local` — `Password123!` — tenant `demo-yard`

---

## 8. Manual smoke flow

1. Open **http://localhost:3000/login** (or `/demo-yard` — redirects to dashboard after sign-in).
2. Sign in as owner → **Suppliers** → add supplier.
2. **Buyers** → add buyer.
3. **Purchases** → record 100 kg at a price → **Inventory** shows stock + avg cost.
4. **Sales** → sell part of stock → inventory decreases; overselling returns error.
5. Sign in as cashier → can record purchases/sales; cannot access owner-only adjustments (nav hidden + API 403).

---

## 9. Known limitations (by design for M2)

- No payment recording beyond `amountPaidAtCreationKes` / `amountReceivedAtCreationKes` on create.
- No receipt printing wired in UI (permissions exist).
- Single-yard: `yard_id` columns nullable for future multi-yard.
- Corrections do not recalculate historical sale COGS (documented in `docs/SYSTEM_RULES.md`).

---

## 10. Next milestone (M3+)

Per `ARCHITECTURE_REVIEW.md` / `CURSOR_NEXT_PROMPT.md`: payment allocations, M-Pesa webhooks, receipts, reporting — after M2 acceptance.
