# YardFlow — R3 Core Ledger Report

**Milestone:** R3 Core Ledger Rebuild  
**Date:** 2026-06-05  
**Base commit:** `c98f891` (R2)  
**Status:** Complete — immutable operational ledger restored

---

## 1. Scope delivered

| In scope | Out of scope (later milestones) |
|----------|----------------------------------|
| Suppliers, buyers (list + create) | M-Pesa, payment allocations |
| Purchases, sales (append-only) | Receipts, billing, CS30 |
| Stock balances, movements | Web UI, mobile app |
| Weighted-average COGS on sales | Super Admin |
| Corrections (purchase/sale) | Full payment engine |
| Stock adjustments (owner) | Supplier FIFO credit |

---

## 2. Database models

**Migration:** `apps/api/prisma/migrations/20260605140000_r3_core_ledger`

| Model | Table | Key fields |
|-------|-------|------------|
| `Supplier` | `suppliers` | `name`, `phone`, `notes`, `isActive`, `balanceKes` (projection) |
| `Buyer` | `buyers` | `name`, `phone`, `notes`, `isActive`, `balanceKes` (projection) |
| `Purchase` | `purchases` | `weightKg`, `pricePerKg`, `totalValueKes`, `paymentStatus`, `correctionApplied`, `idempotencyKey` |
| `Sale` | `sales` | `weightKg`, `pricePerKg`, `costPerKgAtSale`, `totalCostKes`, `grossProfitKes`, `correctionApplied` |
| `StockBalance` | `stock_balances` | Composite PK `(tenantId, categoryId)`; `weightKg`, `averageCostPerKg` |
| `StockMovement` | `stock_movements` | `movementType`, `weightDeltaKg`, `valueDeltaKes`, `referenceType`, `referenceId` |
| `Correction` | `corrections` | `targetType`, `targetId`, signed deltas, `reason` |
| `StockAdjustment` | `stock_adjustments` | `categoryId`, `weightDeltaKg`, `reason` |
| `LedgerEvent` | `ledger_events` | Append-only domain event log |

**Enums:** `PaymentStatus`, `CorrectableType` (PURCHASE/SALE), `StockMovementType` (PURCHASE, SALE, PURCHASE_CORRECTION, SALE_CORRECTION, STOCK_ADJUSTMENT)

---

## 3. Transaction flow

All stock-changing operations run through `LedgerTransactionService` inside a single Prisma transaction:

```
POST /purchases | /sales | /corrections | /inventory/adjustments
        │
        ▼
  LedgerTransactionService
        │
        ├─ ensureStockBalanceRow (upsert zero row; P2002 race-safe)
        ├─ SELECT … FOR UPDATE on stock_balances
        ├─ validate (stock ≥ 0, party exists, correction safety)
        ├─ write Purchase / Sale / Correction / StockAdjustment
        ├─ update StockBalance (weight + weighted average)
        ├─ insert StockMovement
        ├─ update party balanceKes (purchase → supplier, sale → buyer)
        ├─ insert LedgerEvent
        └─ audit log
```

**Append-only:** Purchases and sales are never updated in place. Corrections are separate records that set `correctionApplied = true` on the target.

---

## 4. Stock logic

| Rule | Implementation |
|------|----------------|
| Purchases increase stock | `weightDeltaKg = +weightKg` on `PURCHASE` movement |
| Sales decrease stock | `weightDeltaKg = -weightKg` on `SALE` movement |
| No negative stock | `projectedStockKg()` checked before commit → **409 `STOCK_INSUFFICIENT`** |
| Oversell blocked | Same guard on sale creation |
| Corrections stock-safe | `projectedStockKg()` after delta → **422 `CORRECTION_WOULD_BREAK_STOCK`** |
| Adjustments | Signed delta; no party balance change |

---

## 5. Weighted average implementation

On each purchase (and purchase correction with positive weight):

```
newAvg = (existingQty × existingAvg + newQty × newCost) / (existingQty + newQty)
```

Implemented in `ledger-math.ts` via `@yardflow/utils` `computeWeightedAverageCost`. Sales snapshot `costPerKgAtSale` from the locked balance at sale time; `totalCostKes` and `grossProfitKes` are computed once and never recomputed.

---

## 6. Concurrency protection

1. **Row lock** — `lockStockBalance()` runs `SELECT … FOR UPDATE` on `stock_balances` before any mutation.
2. **Isolation** — `ReadCommitted` (`LEDGER_TRANSACTION_OPTIONS`); Serializable avoided per M2 learnings (spurious `40001` vs clean 409).
3. **Upsert race** — Concurrent first-write to a category catches `P2002` on `stock_balances` upsert and retries via existing row.
4. **Idempotency** — Unique `(tenant_id, idempotency_key)` on purchases/sales; replay returns original row without double stock effect.

**Verified:** Two concurrent 400 kg sales against 500 kg stock → one **201**, one **409**, final stock **100 kg**.

---

## 7. API endpoints

| Resource | Routes |
|----------|--------|
| Suppliers | `GET /v1/suppliers`, `POST /v1/suppliers` |
| Buyers | `GET /v1/buyers`, `POST /v1/buyers` |
| Purchases | `GET /v1/purchases`, `GET /v1/purchases/:id`, `POST /v1/purchases` |
| Sales | `GET /v1/sales`, `GET /v1/sales/:id`, `POST /v1/sales` |
| Inventory | `GET /v1/inventory`, `GET /v1/inventory/movements` |
| Adjustments | `POST /v1/inventory/adjustments` |
| Corrections | `GET /v1/corrections`, `POST /v1/corrections` |

**Permissions:** Cashier — `purchase:create`, `sale:create`. Owner — adds `purchase:correct`, `sale:correct`, `inventory:adjust`.

**Validation:** `packages/validation` — `parties.ts`, `purchases.ts`, `sales.ts`, `corrections.ts`, `adjustments.ts` (R3 field names: `name`, `pricePerKg`).

---

## 8. Tests

**Total: 32** (4 unit + 13 foundation e2e + 15 ledger e2e)

| # | Scenario | File |
|---|----------|------|
| 1 | Purchase increases stock | `ledger.e2e-spec.ts` |
| 2 | Sale decreases stock | `ledger.e2e-spec.ts` |
| 3 | Oversell → 409 | `ledger.e2e-spec.ts` |
| 4 | Weighted average calculation | `ledger.e2e-spec.ts` |
| 5 | Sale profit snapshot | `ledger.e2e-spec.ts` |
| 6 | Correction creates movement | `ledger.e2e-spec.ts` |
| 7 | Correction stock safety → 422 | `ledger.e2e-spec.ts` |
| 8 | Stock adjustment creates movement | `ledger.e2e-spec.ts` |
| 9 | Tenant isolation | `ledger.e2e-spec.ts` |
| 10 | Cashier permissions | `ledger.e2e-spec.ts` |
| 11 | Owner permissions | `ledger.e2e-spec.ts` |
| 12 | Concurrent sales | `ledger.e2e-spec.ts` |
| 13 | Final stock integrity | `ledger.e2e-spec.ts` |
| + | Purchase idempotency replay | `ledger.e2e-spec.ts` |
| + | R2 foundation tests (auth, tenancy, categories) | `app.e2e-spec.ts` |
| + | Permission unit tests | `permissions.unit.spec.ts` |

E2E tests use per-test categories (`createTestCategory`) to avoid cross-test stock pollution.

---

## 9. Commands run

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

## 10. Known limitations

- **Party balances** (`balanceKes`) increment on purchase/sale but no payment allocation engine — all documents default to `unpaid`.
- **No party update/deactivate endpoints** in R3 — list + create only.
- **No sale/purchase list filters** — simple tenant-scoped lists.
- **Corrections POST** requires both `purchase:correct` and `sale:correct` (owner has both).
- **E2E categories** accumulate in DB (`E2E *` names); seed category count test filters them out.

---

## 11. Next milestone

**R4** (or next planned recovery step): Payments and balances — M-Pesa integration, payment allocation engine, receipt flows, and payment status transitions on purchases/sales. Web/mobile UI remain deferred until their respective recovery milestones.
