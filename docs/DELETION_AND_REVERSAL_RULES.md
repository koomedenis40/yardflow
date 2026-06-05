# YardFlow — Deletion & Reversal Rules

**Status:** Source of truth  
**Version:** 1.0  
**Introduced:** M4 (Native Mobile Foundation)  
**Related:** [SYSTEM_RULES.md](./SYSTEM_RULES.md) · [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) · [PERMISSION_MATRIX.md](./PERMISSION_MATRIX.md) · [DATABASE_CONTRACTS.md](./DATABASE_CONTRACTS.md)

---

## 1. Purpose

YardFlow is an **append-only operational ledger**. This document defines, unambiguously, what may and may not be deleted, and which mechanisms replace deletion when a record is wrong.

These rules apply to **every client** — native mobile (`apps/pos`), tenant web (`apps/web`), and any future Super Admin surface. The API is the authoritative enforcement layer; clients must not offer UI for forbidden deletions.

---

## 2. The Golden Rule

> **No operational truth is ever deleted or overwritten.**

Operational records are immutable once committed. Mistakes are resolved by **adding** a new record (correction, reversal, void, or compensating entry) that references the original — never by destroying or editing history.

---

## 3. NEVER delete — operational ledger records

The following record types are **append-only**. There is **no delete endpoint**, no soft-delete flag used to hide them, and no client UI that deletes them:

| Record | Table | Why |
|--------|-------|-----|
| Purchases | `purchases` | Stock + supplier balance source of truth; billing intake basis |
| Sales | `sales` | Stock + buyer balance source of truth; COGS/profit snapshots |
| Supplier payments | `supplier_payments` | Settlement history; FIFO allocation basis |
| Buyer payments | `buyer_payments` | Settlement history; FIFO allocation basis |
| Payment allocations | `payment_allocations` | Audit of how each payment was applied |
| Stock movements | `stock_movements` | Authoritative stock reconciliation trail |
| Corrections | `corrections` | Already the correction mechanism; itself immutable |
| Stock adjustments | `stock_adjustments` | Physical-vs-system reconciliation trail |

**Enforcement:** No `DELETE` route exists for these resources. Any attempt must fail closed (404/405). Mobile and web must never render a delete affordance for them.

---

## 4. How to fix a wrong operational record

Deletion is replaced by these append-only mechanisms (see [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) §7–§9):

| Situation | Mechanism | Permission | Notes |
|-----------|-----------|------------|-------|
| Wrong purchase weight/value | **Purchase correction** | `purchase:correct` (owner) | Signed `weight_delta_kg` / `value_delta_kes` + mandatory reason; stock-safety checked |
| Wrong sale weight/value | **Sale correction** | `sale:correct` (owner) | May return stock to yard; mandatory reason |
| Physical stock ≠ system stock | **Stock adjustment** | `inventory:adjust` (owner) | Reason mandatory; does not touch party balances |
| Wrong/duplicate payment | **Compensating entry / reversal (future)** | owner | Append a reversing payment record; original stays. Full reversal flow is a later milestone — **not in M4** |
| Wrong party on a transaction | **Correct + re-enter** | owner | Correct the original to net-zero impact, then record the correct transaction |

> **M4 scope note:** The mobile app does **not** implement corrections, reversals, adjustments, or any operational deletion. It only creates new operational records (purchases, sales, payments). Fixes are performed by an owner on the web app per the rules above.

---

## 5. Safe deactivation — setup records only

**Setup/reference records** may be **deactivated (soft-disabled)** — never hard-deleted — when safety conditions are met. Deactivation hides the record from new transactions while preserving all history that references it.

Soft-deactivatable records: **suppliers · buyers · categories · users**.

These use an `is_active` flag (or `status` for users). Records are **never physically removed**, preserving referential integrity for historical purchases, sales, payments, and audit logs.

### 5.1 Suppliers / Buyers

`POST`/`PATCH` deactivate (`supplier:deactivate` / `buyer:deactivate`, owner only).

**Allow deactivation only if ALL are true:**

- No outstanding balance — `balance_kes = 0`
- No unresolved supplier credit — `credit_balance_kes = 0` (suppliers)
- No active unpaid/partial transactions — no `purchases`/`sales` with `payment_status ∈ {unpaid, partial}`

**Otherwise:**

- **Block** deactivation
- Return a clear reason, e.g. `Cannot deactivate: supplier has KES 4,200 outstanding across 2 unpaid purchases.`

Reactivation is always allowed (owner).

### 5.2 Categories

`category:deactivate` (owner only).

**Allow deactivation only if ALL are true:**

- No stock on hand — `stock_balances.weight_kg = 0` for the category
- No active recent transaction dependency (no open/unpaid purchases or sales referencing the category in the current operational window)

**Otherwise:**

- **Block** deactivation (default), **or** require explicit owner approval (confirmation step) where policy allows
- Return a clear reason, e.g. `Cannot deactivate: 320 kg on hand. Sell or adjust stock to zero first.`

A deactivated category is hidden from buy/sell category pickers but remains on historical records.

### 5.3 Users

`user:disable` (owner only).

- Users may be **deactivated/disabled** (cannot log in, cannot act) but **never deleted** — audit history must always resolve `created_by` / actor.
- A disabled user's past actions remain intact and attributable.
- Owners cannot disable themselves if they are the sole active owner (prevents tenant lockout).

---

## 6. Decision matrix

| Record | Hard delete | Soft deactivate | Fix mechanism |
|--------|:-----------:|:---------------:|---------------|
| Purchase | ✗ | ✗ | Purchase correction |
| Sale | ✗ | ✗ | Sale correction |
| Supplier payment | ✗ | ✗ | Compensating entry (future reversal) |
| Buyer payment | ✗ | ✗ | Compensating entry (future reversal) |
| Payment allocation | ✗ | ✗ | Re-derived from corrections/reversals |
| Stock movement | ✗ | ✗ | New movement via correction/adjustment |
| Correction | ✗ | ✗ | New correction |
| Stock adjustment | ✗ | ✗ | New adjustment |
| Supplier | ✗ | ✓ (if clear) | Deactivate |
| Buyer | ✗ | ✓ (if clear) | Deactivate |
| Category | ✗ | ✓ (if zero stock) | Deactivate |
| User | ✗ | ✓ | Disable (never delete) |

---

## 7. Client responsibilities (mobile + web)

1. **Never** show delete buttons for operational ledger records.
2. Show deactivate (not delete) only for suppliers, buyers, categories, users — and only to permitted roles.
3. Deactivation is **API-gated**: clients call the deactivate endpoint and surface the API's allow/block reason. Clients must **not** pre-judge eligibility as final truth; the API is authoritative.
4. On a blocked deactivation, display the returned reason clearly (e.g. bottom sheet / inline error).
5. Balances and eligibility shown in the UI are projections from the API, never locally computed authority.

---

## 8. Audit

Every deactivation/reactivation and every correction/adjustment writes an `audit_logs` entry (`tenant_id`, `user_id`, `action`, `entity_type`, `entity_id`, `metadata`, timestamp) per [SYSTEM_RULES.md](./SYSTEM_RULES.md) §22. There is nothing to audit for deletion of operational records because such deletion never occurs.
