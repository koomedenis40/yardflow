# YardFlow — Event Architecture

**Status:** Source of truth (pre-implementation)  
**Version:** 1.0  
**Related:** [SYSTEM_RULES.md](./SYSTEM_RULES.md) · [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) · [DATABASE_CONTRACTS.md](./DATABASE_CONTRACTS.md)

---

## 1. Purpose

YardFlow uses **operational events** to represent committed business facts. Events enable:

- Auditability and forensic replay  
- Projection updates with clear causality  
- Reconciliation and debugging  
- Future async consumers (notifications, analytics) without changing ledger semantics  

Events are **not** UI analytics clicks. They are post-commit records of what happened.

---

## 2. Event Philosophy

| Principle | Rule |
|-----------|------|
| Append-only | Events are never updated or deleted |
| Tenant-scoped | Every event has `tenant_id` |
| Actor-attributed | Human actions include `actor_id` |
| Referenced | Link to `reference_type` + `reference_id` |
| Idempotent sources | M-Pesa and API retries must not duplicate effects |
| Transactional coupling | Critical projection updates occur **in the same DB transaction** as the event insert |

**Two layers:**

1. **Domain tables** (`purchases`, `sales`, …) — primary operational truth  
2. **`ledger_events`** — unified event log for audit, integrations, and reconciliation  

Domain table inserts and `ledger_events` inserts happen in one transaction.

---

## 3. Event Catalog

### Operational — Ledger

| Event type | Trigger | Critical side effects (same TX) |
|------------|---------|----------------------------------|
| `PURCHASE_CREATED` | Purchase committed | Stock ↑, supplier balance ↑, optional payment allocations |
| `SALE_CREATED` | Sale committed | Stock ↓ (locked), buyer balance ↑, COGS snapshot |
| `SUPPLIER_PAYMENT_CONFIRMED` | Cash/manual confirm or M-Pesa B2C confirm | Supplier balance ↓, FIFO allocations, credit pool |
| `BUYER_PAYMENT_CONFIRMED` | Cash/manual confirm or M-Pesa STK confirm | Buyer balance ↓, FIFO allocations |
| `PURCHASE_CORRECTED` | Owner correction | Stock delta, supplier balance delta, billing intake may change |
| `SALE_CORRECTED` | Owner correction | Stock delta, buyer balance delta |
| `STOCK_ADJUSTED` | Owner adjustment | Stock delta only |

### Operational — M-Pesa

| Event type | Trigger | Notes |
|------------|---------|-------|
| `MPESA_INITIATED` | API call to Daraja | `mpesa_transactions` PENDING; no balance change |
| `MPESA_CONFIRMED` | Callback/reconcile | Promotes linked payment to confirmed |
| `MPESA_FAILED` | Callback/timeout | No balance change |
| `MPESA_REVERSED` | Reversal record | Append reversal payment row |

### Operational — Receipts

| Event type | Trigger | Notes |
|------------|---------|-------|
| `RECEIPT_GENERATED` | Ledger commit | `receipts` row + payload snapshot |
| `RECEIPT_PRINTED` | Print/reprint | `print_count++`, audit only |

### Platform — Tenant

| Event type | Trigger | Notes |
|------------|---------|-------|
| `TENANT_CREATED` | Platform admin | Seed categories |
| `TENANT_ACTIVATED` | Subscription paid | |
| `TENANT_SUSPENDED` | Billing grace expired | Block operational mutations |
| `BILLING_CYCLE_CLOSED` | Monthly job | Compute intake_kg |
| `INVOICE_PAID` | Owner STK for subscription | Reactivate tenant |

---

## 4. Event Payload Schemas (Illustrative)

### `PURCHASE_CREATED`

```json
{
  "purchase_id": "uuid",
  "supplier_id": "uuid",
  "category_id": "uuid",
  "weight_kg": "100.000",
  "buying_price_per_kg": "50.00",
  "total_value_kes": "5000.00",
  "amount_paid_at_creation_kes": "2000.00",
  "payment_status": "partial"
}
```

### `SALE_CREATED`

```json
{
  "sale_id": "uuid",
  "buyer_id": "uuid",
  "category_id": "uuid",
  "weight_kg": "50.000",
  "selling_price_per_kg": "80.00",
  "total_value_kes": "4000.00",
  "cost_per_kg_at_sale": "50.00",
  "cogs_kes": "2500.00",
  "gross_profit_kes": "1500.00"
}
```

### `SUPPLIER_PAYMENT_CONFIRMED`

```json
{
  "payment_id": "uuid",
  "supplier_id": "uuid",
  "amount_kes": "800.00",
  "method": "cash",
  "allocations": [
    { "purchase_id": "uuid", "amount_kes": "500.00" },
    { "purchase_id": "uuid", "amount_kes": "300.00" }
  ],
  "credit_remaining_kes": "0.00"
}
```

### `MPESA_CONFIRMED`

```json
{
  "mpesa_transaction_id": "uuid",
  "mpesa_receipt_number": "QAB1234567",
  "linked_payment_type": "sale_payment",
  "linked_payment_id": "uuid"
}
```

---

## 5. Projections

Projections are **read-optimized copies** of ledger state. They must be reconstructible from events + domain tables.

### Critical (synchronous — same transaction as event)

| Projection | Table/field | Updated on |
|------------|-------------|------------|
| Stock by category | `stock_balances.weight_kg`, `avg_cost_per_kg` | Purchase, sale, correction, adjustment |
| Supplier owed | `suppliers.balance_kes` | Purchase, supplier payment, purchase correction |
| Supplier credit | `suppliers.credit_balance_kes` | Supplier payment (advance remainder) |
| Buyer owed | `buyers.balance_kes` | Sale, buyer payment, sale correction |
| Line payment status | `purchases.payment_status`, `sales.payment_status` | Allocations change |

### Derived (async acceptable)

| Projection | Refresh |
|------------|---------|
| Dashboard KPIs (today kg, revenue) | Cache 30–60s or on mutation invalidate |
| Billing `intake_kg` for open cycle | On purchase/correction or nightly |
| Report materialized views | Hourly or on-demand |

**Rule:** If async projection lags, OLTP must still use `stock_balances` from synchronous path for sale validation.

---

## 6. Event → Handler Map (MVP)

In-process handlers (NestJS EventEmitter or direct service calls). **No external message broker required for MVP.**

| Event | Handlers (same TX unless noted) |
|-------|--------------------------------|
| `PURCHASE_CREATED` | Update projections, insert `ledger_events`, `audit_logs`, `receipts` |
| `SALE_CREATED` | Same |
| `SUPPLIER_PAYMENT_CONFIRMED` | Allocations, projections, receipt |
| `BUYER_PAYMENT_CONFIRMED` | Allocations, projections, receipt |
| `MPESA_CONFIRMED` | Promote payment → run payment confirmed flow |
| `PURCHASE_CORRECTED` | Stock + supplier + billing intake recalc |
| `STOCK_ADJUSTED` | Stock only |
| `RECEIPT_PRINTED` | Audit async OK |
| `TENANT_SUSPENDED` | Cache permission deny list |

Phase 2: publish to queue for SMS, WhatsApp, webhooks.

---

## 7. Idempotency & Deduplication

| Source | Key | Behavior |
|--------|-----|----------|
| API mutations | `Idempotency-Key` + `tenant_id` | Return existing entity |
| M-Pesa callback | `mpesa_receipt_number` or `checkout_request_id` | Second processing no-op |
| POS offline sync | Same client-generated key | Same as API |

`ledger_events` should not duplicate for the same idempotent business action — check domain table existence before insert.

---

## 8. Reconciliation

Scheduled jobs validate projection integrity:

| Check | Events / tables compared |
|-------|--------------------------|
| Stock | `stock_balances` vs `stock_movements` |
| Supplier balance | Projections vs purchases − payments − corrections + credit |
| Buyer balance | Projections vs sales − payments − corrections |
| Billing intake | `billing_cycles.intake_kg` vs purchases − negative purchase corrections |
| M-Pesa orphans | PENDING > threshold → poll Daraja |

**On mismatch:** emit `RECONCILIATION_DRIFT_DETECTED` alert event (platform); **no silent auto-fix**.

---

## 9. Relationship to PRD Event List

PRD §8 mandates event types:

- `PURCHASE_CREATED` ✓  
- `PAYMENT_ADDED` → implemented as `SUPPLIER_PAYMENT_CONFIRMED` / `BUYER_PAYMENT_CONFIRMED` (more explicit)  
- `SALE_CREATED` ✓  
- `STOCK_ADJUSTMENT` → `STOCK_ADJUSTED` ✓  
- `PURCHASE_CORRECTION` → `PURCHASE_CORRECTED` ✓  

Sale correction added as `SALE_CORRECTED` (required by architecture, implied by PRD immutability rules).

---

## 10. Event Ordering

Within a tenant, events are ordered by `created_at` (UTC). **No global ordering across tenants.**

For offline POS sync, client sends mutations in **local creation order**; server processes with idempotency — order matters only when later mutation depends on earlier (e.g. sale after purchase stock). Server validates stock at commit time regardless of queue order.

---

## 11. Future Extensions (Phase 2+)

- Outbox table → Redis/RabbitMQ for SMS and WhatsApp receipts  
- `ledger_events` export to data warehouse  
- Domain event replay tool for projection rebuild (disaster recovery)  
- `YARD_CREATED` when multi-yard enabled  
