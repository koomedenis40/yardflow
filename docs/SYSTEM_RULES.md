# YardFlow — System Rules

**Status:** Source of truth (pre-implementation)  
**Version:** 1.1  
**Related:** [PRD.md](../PRD.md) · [ARCHITECTURE_REVIEW.md](../ARCHITECTURE_REVIEW.md) · [UI_DIRECTION.md](./UI_DIRECTION.md) · [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) · [DATABASE_CONTRACTS.md](./DATABASE_CONTRACTS.md) · [PERMISSION_MATRIX.md](./PERMISSION_MATRIX.md) · [EVENT_ARCHITECTURE.md](./EVENT_ARCHITECTURE.md) · [DELETION_AND_REVERSAL_RULES.md](./DELETION_AND_REVERSAL_RULES.md)

---

## 1. Purpose

YardFlow is a **multi-tenant scrap yard operations system**. Its core purpose is to create a trusted operational record of:

- scrap bought and sold in **kilograms only**
- supplier balances (payables)
- buyer balances (receivables)
- payments (cash, manual, M-Pesa)
- stock movement
- receipts (views of saved ledger records)
- SaaS billing based on **monthly intake volume**

YardFlow is **not** a full accounting system. It is an operational ledger and stock management platform.

---

## 2. Core Philosophy

**No operational truth is overwritten.**

Records are append-only. Mistakes are corrected through correction records, not deletion or silent edits.

| Forbidden | Required |
|-----------|----------|
| Delete purchases, sales, or payments | Append-only ledger rows |
| Overwrite payment amounts | New payment or correction records |
| Edit stock balances directly | Stock changes only via purchase, sale, adjustment, or correction |
| Finalize M-Pesa before confirmation | PENDING until Safaricom confirms |

**Deletion policy:** Operational ledger records (purchases, sales, supplier/buyer payments, payment allocations, stock movements, corrections, stock adjustments) can **never** be deleted or soft-hidden. Only **setup records** (suppliers, buyers, categories, users) may be **deactivated** under safety conditions — never hard-deleted. Full rules, including deactivation eligibility and block reasons, are defined in **[DELETION_AND_REVERSAL_RULES.md](./DELETION_AND_REVERSAL_RULES.md)**. All clients (mobile + web) must honor these rules; the API enforces them authoritatively.

---

## 3. Priority Order (Conflict Resolution)

When rules appear to conflict, apply this precedence:

1. **Stock integrity** — never negative stock; never oversell  
2. **Tenant isolation** — no cross-tenant data access  
3. **Append-only ledger** — immutable operational records  
4. **Payment confirmation** — balances update only on confirmed payments (M-Pesa async)  
5. **Projections** — `stock_balances`, party balances updated in same DB transaction as ledger write  
6. **UX convenience** — never overrides 1–5  

---

## 4. Core Invariants

These rules must **always** remain true:

1. Every operational record belongs to exactly one `tenant_id`.
2. Every purchase increases stock for the purchase category.
3. Every sale decreases stock for the sale category.
4. Stock must never go below zero.
5. A sale must never exceed available stock at commit time.
6. Payments are append-only; prior payment rows are never mutated.
7. Receipts are reproducible views of saved transaction data.
8. Supplier and buyer balances are derived from ledger activity and allocations.
9. Corrections reference the original transaction and include a mandatory reason.
10. Suspended tenants can view data but cannot create new operational transactions.
11. Billing intake uses **net purchased kilograms** for the billing period (see §16).
12. All timestamps stored in **UTC**; displayed in **Africa/Nairobi** (EAT, UTC+3).

---

## 5. Tenant Rules

Every dealer is a **tenant**.

All tenant-scoped records must include:

```txt
tenant_id NOT NULL
```

**MVP:** One yard per tenant. **Phase 2:** Multi-yard — all operational tables include nullable `yard_id` from day one for forward compatibility.

Tenant isolation is mandatory at:

- API authorization layer  
- Application query filters  
- PostgreSQL Row-Level Security (RLS)  
- Cache key prefixes (`tenant:{id}:...`)  
- Object storage paths (`tenants/{tenant_id}/...`)  

A user from tenant A must never access tenant B’s suppliers, buyers, purchases, sales, stock, payments, receipts, or billing data.

**Tenant statuses:** `trial` · `active` · `past_due` · `suspended` · `cancelled`

---

## 6. Scrap Category Rules

Default categories (seeded on tenant creation):

- Light Steel, Heavy Steel, Gumboots, Plastics, Cast Iron, Books  
- Soft Aluminium, Hard Aluminium, Dawa, Brass  
- Big Batteries, Small Batteries  

Owners can:

- add categories  
- edit names and default prices  
- deactivate categories  

**Deactivation:** Block deactivation when `stock_balances.weight_kg > 0` for that category. Prefer deactivate over delete.

Default buying/selling prices **pre-fill** UI only; each purchase/sale stores its own price snapshot.

---

## 7. Weight Rules

**Kilograms are the only operational stock unit.** No alternate units (tons, pieces) in MVP.

| Rule | Value |
|------|-------|
| Purchase/sale weight | Must be `> 0` |
| DB type | `NUMERIC(12,3)` |
| Display | 1–3 decimal places (tenant setting) |
| Negative weight | Only in `corrections` or `stock_adjustments` (signed delta) |

---

## 8. Money Rules

Default currency: **Kenya Shillings (KES)**.

| Rule | Value |
|------|-------|
| DB type | `NUMERIC(14,2)` |
| Floating point | Forbidden for money and weight |
| Rounding | Half-up at line level |
| Overpayment | Blocked against a specific purchase/sale balance |
| Supplier credit | Unallocated advance lives in **credit pool** (see §12) |

Financial values on purchases/sales are **transaction snapshots** — never retroactively changed.

---

## 9. Purchase Rules

A purchase represents scrap **entering** the yard.

**Required fields:** supplier, category, `weight_kg`, `buying_price_per_kg`, `total_value_kes`, `amount_paid_at_creation_kes` (may be 0), `created_by`, `created_at`, `idempotency_key`.

**Formulas:**

```txt
total_value_kes = weight_kg × buying_price_per_kg
supplier_balance_delta = total_value_kes - amount_paid_at_creation_kes
stock_delta = +weight_kg
```

**On create (single transaction):**

- Insert immutable `purchases` row  
- Update `stock_balances` and weighted average cost  
- Insert `stock_movement`  
- Update `suppliers.balance_kes`  
- If paid at creation: insert `purchase_payments` (confirmed) + FIFO allocation  
- Emit `PURCHASE_CREATED`  

Purchases **cannot** be deleted. Errors use `PURCHASE_CORRECTED` (see §13).

**Payment status** (derived): `unpaid` · `partial` · `paid` — from sum of confirmed allocations vs. `total_value_kes`.

---

## 10. Sale Rules

A sale represents scrap **leaving** the yard.

**Precondition:**

```txt
available_stock_kg >= sale_weight_kg
```

(enforced with row lock on `stock_balances` at commit time)

**Formulas:**

```txt
total_sale_value_kes = weight_kg × selling_price_per_kg
buyer_balance_delta = total_sale_value_kes - amount_received_at_creation_kes
stock_delta = -weight_kg
COGS_kes = weight_kg × cost_per_kg_at_sale
gross_profit_kes = total_sale_value_kes - COGS_kes
```

**On create:** snapshot `cost_per_kg_at_sale` from current category weighted average at sale time.

Sales **cannot** be deleted. Warn (do not block) if selling below cost; owner policy may require confirmation.

---

## 11. Stock Rules

**Authoritative formula:**

```txt
current_stock_kg =
  SUM(purchase weights)
- SUM(sale weights)
+ SUM(stock_adjustment deltas)
+ SUM(purchase_correction weight deltas)
+ SUM(sale_correction weight deltas)
```

**Performance:** Maintain `stock_balances` projection; update in the **same database transaction** as every stock-affecting event.

**Reconciliation:** Nightly job compares projection vs. movement sum; alert on drift; **never auto-correct silently**.

---

## 12. Payment Rules

Payments are **append-only**.

| Direction | Effect |
|-----------|--------|
| Supplier payment (confirmed) | Reduces amount owed to supplier |
| Buyer payment (confirmed) | Reduces amount owed by buyer |

**Methods:** `cash` · `manual` · `mpesa_stk` · `mpesa_b2c`

**States:** `pending` · `confirmed` · `failed` · `reversed`

- **Cash/manual:** `confirmed` immediately on insert.  
- **M-Pesa:** `pending` until callback or reconciliation confirms; **no balance change while pending**.

**Allocation:**

- Payments may link to a specific purchase/sale, or  
- Enter **unallocated** and apply **FIFO** to oldest unpaid purchase/sale for that party.

**Overpayment:** Block payment amount greater than party outstanding balance (unless explicitly recording advance to credit pool — see §13).

---

## 13. Supplier Credit Pool & FIFO Allocation

Supplier **advance payments** (payment without a specific purchase, or amount exceeding a purchase balance) increase **`suppliers.credit_balance_kes`**.

**Allocation algorithm (on every confirmed supplier payment):**

1. If `purchase_id` specified: allocate up to that purchase’s remaining balance first.  
2. Remaining amount applies **FIFO** to oldest unpaid purchases (by `created_at`).  
3. Any remainder stays in `credit_balance_kes`.

Record each slice in `payment_allocations`.

**Buyer side:** Mirror FIFO for unpaid sales.

---

## 14. Correction Rules

Corrections fix wrong purchase or sale records.

**Must include:** `correctable_type`, `correctable_id`, `reason`, `created_by`, signed `weight_delta_kg` and/or `value_delta_kes`.

**Must never:** UPDATE or DELETE the original purchase/sale row.

**Blocking rule (purchase correction reducing stock):**

```txt
projected_stock_kg + weight_delta_kg >= 0
```

If false → **reject** correction. Owner must use stock adjustment separately if physical reality differs.

**Side effects:**

- Update stock projection and movements  
- Update supplier/buyer balance by `value_delta_kes`  
- Recompute purchase/sale `payment_status` if value changes  
- Negative purchase corrections reduce **billing intake** for the period  

---

## 15. Stock Adjustment Rules

Used when **physical stock ≠ system stock** (theft, scale error, count mismatch).

- **Owner only**  
- Mandatory `reason`  
- Affects stock only — **does not** change supplier or buyer balances  
- Resulting stock must not go negative  

---

## 16. COGS & Profit Rules

**Method:** Weighted average cost per category per tenant.

**On purchase:**

```txt
new_avg_cost_per_kg =
  (existing_kg × existing_avg_cost + new_kg × purchase_price_per_kg)
  / (existing_kg + new_kg)
```

**On sale:**

```txt
cost_per_kg_at_sale = avg_cost_per_kg at moment of sale (snapshot on sale row)
COGS_kes = weight_kg × cost_per_kg_at_sale
profit_kes = total_sale_value_kes - COGS_kes
```

Profit reports use sale snapshots — stable even if later purchases change average cost.

---

## 17. Billing Rules

Billing is **monthly intake-based**, not stock, sales, or profit.

```txt
monthly_net_intake_kg =
  SUM(purchase.weight_kg) in billing period
- SUM(negative purchase correction weight_kg) in billing period
```

**Tier assignment** uses end-of-period total (no mid-month tier upgrade/downgrade proration in MVP).

| Monthly net intake | Price (KES) |
|--------------------|------------:|
| 0–999 kg | 999 |
| 1,000–10,000 kg | 1,588 |
| 10,001–50,000 kg | 3,500 |
| 50,000+ kg | Custom |

Do **not** bill on: current stock, sales volume, profit, or payment count alone.

---

## 18. Suspension Rules

When tenant status is `suspended`:

| Allowed | Blocked |
|---------|---------|
| Login | New purchases |
| View reports, stock, history | New sales |
| Reprint receipts | New supplier/buyer operational payments |
| Export data | Stock adjustments |
| Pay SaaS invoice (`billing:pay`) | Corrections |
| | New receipt for new transactions |

In-flight M-Pesa initiated before suspension may complete; no new M-Pesa operational requests.

---

## 19. Receipt Rules

Receipts are **views** of committed ledger records — not separate financial truth.

**Types:** purchase · supplier_payment · sale · buyer_payment · correction (optional) · stock_adjustment (optional)

**Receipt number format:**

```txt
{TENANT_PREFIX}-{TYPE}-{YYYYMM}-{SEQ}
```

Unique per tenant. Reprint increments `print_count` and writes audit log.

**Print failure** must not roll back the underlying transaction.

---

## 20. M-Pesa Rules

M-Pesa is **asynchronous** and **idempotent**.

| State | Balance impact |
|-------|----------------|
| pending | None |
| confirmed | Apply payment + FIFO allocation |
| failed / timeout | None; operator may retry |
| reversed | Separate reversal record (append-only) |

- Duplicate callbacks: no duplicate payments (`mpesa_receipt_number` unique when present).  
- All operational POSTs require `Idempotency-Key`.  
- MVP: platform-level Daraja credentials.  

---

## 21. POS Offline Rules (MVP)

**Queue-only** — not full offline ledger.

| Behavior | Rule |
|----------|------|
| Network down | Queue mutations locally (SQLite/MMKV) |
| On reconnect | Sync in order with same `Idempotency-Key` |
| Duplicate sync | Server returns original response |
| Stock display | May be stale offline; sale validated at server commit |
| M-Pesa | Cannot complete offline; queue payment initiation only if policy allows, else block |

Full offline mode is **Phase 2** per PRD.

---

## 22. Audit Rules

Mandatory audit for: login, failed login, purchase, sale, payment, correction, stock adjustment, receipt print/reprint, role change, tenant status change, billing events, suspension.

Each entry: `tenant_id`, `user_id`, `action`, `entity_type`, `entity_id`, `metadata`, `ip`, `user_agent`, `created_at` (UTC).

---

## 23. Timezone & Localization

| Concern | Rule |
|---------|------|
| Storage | UTC (`timestamptz`) |
| Display default | `Africa/Nairobi` |
| Daily reports | Calendar day in tenant timezone |
| Receipt print time | Tenant timezone |

---

## 24. Idempotency

All ledger mutation endpoints (`POST` purchases, sales, payments, corrections, adjustments) require:

```http
Idempotency-Key: <client-generated-uuid>
```

Unique constraint: `(tenant_id, idempotency_key)` on applicable tables. Replay returns **same** response body and IDs.

---

## 25. Client applications (UI)

| Client | Role | Rules |
|--------|------|--------|
| **POS / mobile** | Primary operations | Fast buy/sell/pay flows; bottom nav; receipt-first; see [UI_DIRECTION.md](./UI_DIRECTION.md) |
| **Tenant web** | Owner review | Read-heavy + selective create; [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) tokens; not POS replacement |
| **Platform web** | Super Admin | Separate routes; no tenant data without platform role; future milestone |

UI must not expose actions the user lacks permission for (hide nav + API 403). Tenant scope always from JWT, never from form fields.
