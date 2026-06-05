# YardFlow — Database Contracts

**Status:** Source of truth (pre-implementation)  
**Version:** 1.0  
**Related:** [SYSTEM_RULES.md](./SYSTEM_RULES.md) · [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) · [EVENT_ARCHITECTURE.md](./EVENT_ARCHITECTURE.md)

---

## 1. Database Principles

The database is the last line of defense for operational integrity.

1. **Tenant isolation** — `tenant_id NOT NULL` + RLS on all tenant tables  
2. **Append-only ledger** — no UPDATE/DELETE on immutable operational tables (application role)  
3. **Transactional projections** — `stock_balances`, party balances updated in same TX as ledger insert  
4. **Immutable payments** — payment rows insert-only; reversals are new rows  
5. **Decimal types only** — no float for weight or money  
6. **Idempotency** — `UNIQUE(tenant_id, idempotency_key)` on mutation tables  
7. **Stock never negative** — enforced at commit via lock + CHECK on projection  

---

## 2. Numeric Types

### Weight — `NUMERIC(12,3)`

Used for: purchase/sale weight, stock balances, movements, corrections, adjustments, billing `intake_kg`.

### Money — `NUMERIC(14,2)`

Used for: prices, totals, payments, balances, invoices, COGS, profit.

---

## 3. Identity & Tenancy

### `tenants`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | |
| slug | TEXT UNIQUE | URL segment |
| status | ENUM | trial, active, past_due, suspended, cancelled |
| timezone | TEXT | default `Africa/Nairobi` |
| currency | TEXT | default `KES` |
| receipt_prefix | TEXT | for receipt numbers |
| settings | JSONB | display decimals, language, etc. |
| created_at | TIMESTAMPTZ | UTC |
| updated_at | TIMESTAMPTZ | |

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| full_name | TEXT | |
| email | TEXT UNIQUE | nullable if phone-only |
| phone | TEXT | |
| password_hash | TEXT | bcrypt/argon2 |
| is_platform_admin | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | |

### `user_tenants`

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID FK | |
| tenant_id | UUID FK | |
| role | ENUM | owner, cashier |
| is_active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

**Unique:** `(user_id, tenant_id)`

---

## 4. Catalog & Parties

### `scrap_categories`

| Column | Type |
|--------|------|
| id | UUID PK |
| tenant_id | UUID FK |
| yard_id | UUID NULL |
| name | TEXT |
| default_buying_price_per_kg | NUMERIC(14,2) |
| default_selling_price_per_kg | NUMERIC(14,2) |
| is_active | BOOLEAN |
| sort_order | INT |
| created_at, updated_at | TIMESTAMPTZ |

**Seed:** 12 default categories on tenant create.

### `suppliers`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| yard_id | UUID NULL | |
| full_name | TEXT | |
| phone | TEXT | indexed for duplicate warn |
| id_number | TEXT NULL | |
| location | TEXT NULL | |
| notes | TEXT NULL | |
| balance_kes | NUMERIC(14,2) | **projection** — owed TO supplier |
| credit_balance_kes | NUMERIC(14,2) | **projection** — unallocated advance |
| is_active | BOOLEAN | |
| created_at, updated_at | TIMESTAMPTZ | |

**Rule:** Cannot deactivate/delete with `balance_kes > 0` OR `credit_balance_kes > 0`.

### `buyers`

Same as suppliers except **no** `credit_balance_kes` in MVP (buyer advances optional Phase 2).

| Column | Type |
|--------|------|
| balance_kes | NUMERIC(14,2) — owed BY buyer |

---

## 5. Immutable Ledger Tables

### `purchases`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| yard_id | UUID NULL | |
| supplier_id | UUID FK | |
| category_id | UUID FK | |
| weight_kg | NUMERIC(12,3) | CHECK > 0 |
| buying_price_per_kg | NUMERIC(14,2) | |
| total_value_kes | NUMERIC(14,2) | snapshot |
| amount_paid_at_creation_kes | NUMERIC(14,2) | snapshot |
| payment_status | ENUM | unpaid, partial, paid |
| notes | TEXT NULL | |
| created_by | UUID FK | |
| idempotency_key | TEXT | |
| created_at | TIMESTAMPTZ | |

**Constraints:**

- `UNIQUE(tenant_id, idempotency_key)`  
- Application role: **INSERT only** (no UPDATE/DELETE of operational columns)  
- `payment_status` may be updated by system as allocations change (derived projection field — document as exception)

### `sales`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id, yard_id, buyer_id, category_id | | |
| weight_kg | NUMERIC(12,3) | CHECK > 0 |
| selling_price_per_kg | NUMERIC(14,2) | |
| total_value_kes | NUMERIC(14,2) | |
| amount_received_at_creation_kes | NUMERIC(14,2) | |
| payment_status | ENUM | |
| cost_per_kg_at_sale | NUMERIC(14,2) | COGS snapshot |
| cogs_kes | NUMERIC(14,2) | |
| gross_profit_kes | NUMERIC(14,2) | |
| created_by, idempotency_key, created_at | | |

Same immutability rules as `purchases`.

### `purchase_payments`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| supplier_id | UUID FK | |
| purchase_id | UUID NULL | null = unallocated / advance |
| amount_kes | NUMERIC(14,2) | CHECK > 0 |
| payment_method | ENUM | cash, manual, mpesa_stk, mpesa_b2c |
| status | ENUM | pending, confirmed, failed, reversed |
| mpesa_transaction_id | UUID NULL | |
| created_by | UUID FK | |
| idempotency_key | TEXT | |
| created_at | TIMESTAMPTZ | |

**Rule:** Only `confirmed` rows affect balances.

### `sale_payments`

Mirror `purchase_payments` with `buyer_id`, `sale_id`.

### `payment_allocations`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| payment_type | ENUM | purchase_payment, sale_payment |
| payment_id | UUID | |
| target_type | ENUM | purchase, sale |
| target_id | UUID | |
| allocated_amount_kes | NUMERIC(14,2) | |
| created_at | TIMESTAMPTZ | |

**Append-only.** Sum of allocations per payment ≤ payment.amount_kes.

---

## 6. Inventory Tables

### `stock_balances`

| Column | Type | Notes |
|--------|------|-------|
| tenant_id | UUID FK | |
| category_id | UUID FK | |
| yard_id | UUID NULL | |
| weight_kg | NUMERIC(12,3) | CHECK >= 0 |
| avg_cost_per_kg | NUMERIC(14,2) | weighted average |
| version | INT | optimistic lock |
| updated_at | TIMESTAMPTZ | |

**Primary key:** `(tenant_id, category_id)` — or include `yard_id` when multi-yard enabled.

**Sale flow:** `SELECT ... FOR UPDATE` before validation.

### `stock_movements`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| category_id | UUID FK | |
| movement_type | ENUM | purchase, sale, purchase_correction, sale_correction, stock_adjustment |
| weight_delta_kg | NUMERIC(12,3) | signed |
| reference_type | TEXT | |
| reference_id | UUID | |
| running_balance_kg | NUMERIC(12,3) | snapshot after movement |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | |

**Append-only.**

### `corrections`

| Column | Type |
|--------|------|
| id | UUID PK |
| tenant_id | UUID FK |
| correctable_type | ENUM purchase, sale |
| correctable_id | UUID |
| category_id | UUID |
| weight_delta_kg | NUMERIC(12,3) |
| value_delta_kes | NUMERIC(14,2) |
| reason | TEXT NOT NULL |
| created_by | UUID |
| created_at | TIMESTAMPTZ |

### `stock_adjustments`

| Column | Type |
|--------|------|
| id | UUID PK |
| tenant_id | UUID FK |
| category_id | UUID FK |
| weight_delta_kg | NUMERIC(12,3) |
| reason | TEXT NOT NULL |
| created_by | UUID |
| created_at | TIMESTAMPTZ |

---

## 7. M-Pesa

### `mpesa_transactions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| direction | ENUM | inbound, outbound |
| amount_kes | NUMERIC(14,2) | |
| phone | TEXT | |
| status | ENUM | pending, confirmed, failed, timeout, reversed |
| checkout_request_id | TEXT NULL | |
| merchant_request_id | TEXT NULL | |
| mpesa_receipt_number | TEXT NULL | UNIQUE when not null |
| account_reference | TEXT | tenant routing for callback |
| raw_request | JSONB | |
| raw_callback | JSONB | |
| linked_payment_type | ENUM NULL | |
| linked_payment_id | UUID NULL | |
| created_at | TIMESTAMPTZ | |
| confirmed_at | TIMESTAMPTZ NULL | |

---

## 8. Receipts

### `receipts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| receipt_number | TEXT | UNIQUE per tenant |
| receipt_type | ENUM | purchase, supplier_payment, sale, buyer_payment, correction, adjustment |
| reference_type | TEXT | |
| reference_id | UUID | |
| payload_json | JSONB | immutable print snapshot |
| print_count | INT default 0 | |
| created_at | TIMESTAMPTZ | |
| printed_at | TIMESTAMPTZ NULL | |

---

## 9. Billing

### `subscriptions`

| Column | Type |
|--------|------|
| tenant_id | UUID PK/FK |
| plan_tier | TEXT |
| status | ENUM |
| current_period_start | DATE |
| current_period_end | DATE |
| grace_ends_at | TIMESTAMPTZ NULL |

### `billing_cycles`

| Column | Type |
|--------|------|
| id | UUID PK |
| tenant_id | UUID FK |
| period_start | DATE |
| period_end | DATE |
| intake_kg | NUMERIC(12,3) |
| tier_name | TEXT |
| amount_kes | NUMERIC(14,2) |
| status | ENUM open, invoiced, paid, overdue, cancelled |

### `invoices`

| Column | Type |
|--------|------|
| id | UUID PK |
| tenant_id | UUID FK |
| billing_cycle_id | UUID FK |
| amount_kes | NUMERIC(14,2) |
| status | ENUM |
| due_date | DATE |
| paid_at | TIMESTAMPTZ NULL |
| mpesa_transaction_id | UUID NULL |

---

## 10. Event & Audit

### `ledger_events`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| event_type | TEXT | e.g. PURCHASE_CREATED |
| payload | JSONB | |
| actor_id | UUID NULL | |
| reference_type | TEXT NULL | |
| reference_id | UUID NULL | |
| created_at | TIMESTAMPTZ | |

**Append-only.** See [EVENT_ARCHITECTURE.md](./EVENT_ARCHITECTURE.md).

### `audit_logs`

| Column | Type |
|--------|------|
| id | UUID PK |
| tenant_id | UUID NULL | platform actions may be null |
| user_id | UUID NULL |
| action | TEXT |
| entity_type | TEXT |
| entity_id | UUID NULL |
| metadata_json | JSONB |
| ip_address | INET/TEXT |
| user_agent | TEXT |
| created_at | TIMESTAMPTZ |

---

## 11. Indexes (Required)

```txt
(tenant_id, created_at DESC)          -- on purchases, sales, payments
(tenant_id, supplier_id)            -- purchases, purchase_payments
(tenant_id, buyer_id)               -- sales, sale_payments
(tenant_id, category_id)            -- stock_balances
(tenant_id, idempotency_key)        -- unique on mutations
(tenant_id, receipt_number)         -- unique
mpesa_transactions(checkout_request_id)
mpesa_transactions(mpesa_receipt_number) UNIQUE partial
suppliers(tenant_id, phone)         -- duplicate detection
```

---

## 12. Row-Level Security

Enable RLS on all tenant-scoped tables.

```sql
-- Per request/transaction:
SET LOCAL app.current_tenant = '<tenant_uuid>';

-- Policy:
CREATE POLICY tenant_isolation ON purchases
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

Platform admin queries use separate role bypassing RLS (audited).

---

## 13. Atomic Transaction Contracts

### Purchase (required steps in one TX)

1. INSERT `purchases`  
2. INSERT `stock_movements`  
3. UPDATE `stock_balances` (+ weight, recalc avg_cost, version++)  
4. UPDATE `suppliers.balance_kes`  
5. IF paid: INSERT `purchase_payments` + `payment_allocations`  
6. UPDATE `purchases.payment_status`  
7. INSERT `ledger_events`, `audit_logs`, `receipts`  

### Sale (required steps)

1. `SELECT stock_balances FOR UPDATE`  
2. Validate stock  
3. INSERT `sales` with COGS snapshot  
4. INSERT `stock_movements`  
5. UPDATE `stock_balances`  
6. UPDATE `buyers.balance_kes`  
7. Payments, events, audit, receipt  

### M-Pesa confirm

1. Lock `mpesa_transactions`  
2. Idempotent status check  
3. UPDATE status  
4. INSERT/confirm payment + allocations  
5. UPDATE party balances + payment_status  
6. Audit  

---

## 14. Reconciliation Jobs

| Job | Validates |
|-----|-----------|
| stock-reconcile | `stock_balances.weight_kg` vs SUM(movements) |
| supplier-reconcile | `balance_kes` vs purchases − payments − corrections |
| buyer-reconcile | `balance_kes` vs sales − payments − corrections |
| billing-intake-reconcile | `billing_cycles.intake_kg` vs purchases − corrections |
| mpesa-reconcile | pending > N minutes → poll Daraja |
| receipt-sequence | no gaps in receipt_number sequence (alert only) |

On drift: **alert** — do not auto-fix without operator action.

---

## 15. Reporting Contract

Reports read from immutable tables + projections. Default filter timezone: **Africa/Nairobi**.

Required reports: daily purchases, daily sales, stock valuation, supplier balances, buyer balances, profit (COGS-based), category performance, billing intake.

Heavy exports: async job; do not block OLTP transactions.
