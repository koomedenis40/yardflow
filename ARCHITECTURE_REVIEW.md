# YardFlow — Software Architecture Review

**Document type:** Technical product discovery & implementation planning  
**Version:** 1.0  
**Date:** 2026-06-03  
**Status:** Pre-implementation — no code generated  
**Input:** [PRD.md](./PRD.md)

---

## Executive Summary

YardFlow is a **multi-tenant operational ledger** for scrap yards: weight-based inventory, supplier/buyer balance tracking, partial payments, M-Pesa integration, thermal receipts, and intake-based SaaS billing. It is explicitly **not** a full accounting system — it is a trusted record of stock movement and payment state.

This review identifies **14 architectural risks**, **23 missing or underspecified requirements**, and proposes a **production-grade architecture** centered on:

1. **Append-only operational events** as the source of truth  
2. **Materialized stock and balance projections** updated atomically inside DB transactions  
3. **Strict tenant isolation** at every layer from day one  
4. **Idempotent M-Pesa webhook handling** with explicit payment state machines  
5. **Phased delivery** that ships operational value before billing automation  

The recommended stack (NestJS, Prisma, PostgreSQL, Next.js, React Native) is sound. The critical engineering work is **transaction design**, **ledger semantics**, and **concurrency control** — not framework selection.

---

## Table of Contents

- [A. Product Understanding](#a-product-understanding)
- [B. System Architecture Proposal](#b-system-architecture-proposal)
- [C. Database Architecture](#c-database-architecture)
- [D. Technical Risk Analysis](#d-technical-risk-analysis)
- [E. Infrastructure Proposal](#e-infrastructure-proposal)
- [F. Recommended Development Phases](#f-recommended-development-phases)
- [G. Suggested Monorepo Structure](#g-suggested-monorepo-structure)
- [H. Recommended Engineering Standards](#h-recommended-engineering-standards)
- [I. UI/UX Operational Recommendations](#i-uiux-operational-recommendations)
- [Appendix: PRD Gap Register](#appendix-prd-gap-register)

---

# A. Product Understanding

## A.1 System Definition

YardFlow replaces notebook-based scrap yard operations with a **digitized, immutable operational ledger**. Each tenant (scrap dealer) operates an independent yard with:

| Domain | What is tracked | Unit of measure |
|--------|-----------------|-----------------|
| **Intake (Purchases)** | Scrap acquired from suppliers | Kilograms |
| **Outflow (Sales)** | Scrap sold to buyers | Kilograms |
| **Inventory** | Net stock per scrap category | Kilograms |
| **Supplier ledger** | Amount owed to suppliers | KES |
| **Buyer ledger** | Amount owed by buyers | KES |
| **Payments** | Partial/full/advance settlements | KES |
| **SaaS billing** | Platform subscription by monthly intake kg | KES |

The system serves three actor classes:

- **Platform Admin** — tenant lifecycle, subscriptions, platform health  
- **Yard Owner** — full yard operations, reports, settings, user management  
- **Clerk/Cashier** — day-to-day purchase/sale/payment entry and receipt printing  

## A.2 Core Operational Flows

### Flow 1: Purchase (Intake)

```
Supplier arrives with scrap
  → Clerk selects/creates supplier
  → Selects category, enters weight (kg) and price/kg
  → System computes total_value = weight × buying_price_per_kg
  → Optional: record immediate payment (cash/M-Pesa/manual)
  → PURCHASE_CREATED event
  → Stock[category] += weight_kg
  → Supplier balance += (total_value - amount_paid)
  → Generate purchase receipt (thermal/PDF)
```

**Key invariant:** Purchase increases stock. Purchase record is immutable; errors become `PURCHASE_CORRECTION` events.

### Flow 2: Supplier Payment (including advances)

```
Owner/clerk pays supplier (balance or advance)
  → Select supplier (optionally link to specific purchase)
  → Enter amount, method (cash/manual/M-Pesa B2C)
  → PAYMENT_ADDED event
  → Supplier balance -= amount
  → If linked to purchase: purchase balance_remaining decreases
  → Generate supplier payment receipt
```

**Ambiguity in PRD:** Advances may not tie to a specific `purchase_id`. Architecture must support **supplier-level credit** that auto-allocates to oldest unpaid purchases (FIFO allocation) or remains as unallocated credit.

### Flow 3: Sale (Outflow)

```
Buyer requests scrap
  → Clerk selects/creates buyer, category, weight, price/kg
  → System validates: available_stock[category] >= weight_kg
  → SALE_CREATED event
  → Stock[category] -= weight_kg
  → Buyer balance += (total_sale_value - amount_received)
  → Generate sales receipt
```

**Key invariant:** Cannot sell above available stock. Sale is immutable; reversals are correction events.

### Flow 4: Buyer Payment (Collection)

```
Buyer pays outstanding balance
  → Partial or full payment
  → Cash, manual, or M-Pesa STK Push
  → PAYMENT_ADDED event
  → Buyer balance -= amount
  → Optionally allocate to specific sale(s)
  → Generate buyer payment receipt
```

### Flow 5: Stock Adjustment

```
Owner discovers physical count differs from system
  → STOCK_ADJUSTMENT event with reason, signed weight delta
  → Stock[category] += adjustment_kg
  → Requires owner role + mandatory reason
  → Does NOT affect supplier/buyer ledgers
```

### Flow 6: Correction (Purchase or Sale)

```
Error discovered on prior transaction
  → PURCHASE_CORRECTION or SALE_CORRECTION event
  → References original transaction
  → Applies delta to stock and party balance
  → Original record preserved; correction is additive
```

**Critical edge case:** Correcting a purchase downward after some of that stock has been sold may cause **negative available stock**. System must either block the correction or require a compensating stock adjustment with explicit operator acknowledgment.

### Flow 7: M-Pesa Payment (async)

```
Clerk initiates STK Push (buyer collection) or B2C (supplier payout)
  → API call to Safaricom Daraja
  → Payment record created in PENDING state
  → Safaricom callback/webhook arrives (seconds to minutes)
  → Idempotent reconciliation → CONFIRMED or FAILED
  → On CONFIRMED: ledger updated, receipt available
  → On FAILED/TIMEOUT: operator notified, manual retry or cash fallback
```

### Flow 8: SaaS Billing (Platform)

```
End of billing period (monthly)
  → Compute tenant monthly_intake_kg = SUM(purchases.weight_kg) - SUM(purchase_corrections.negative_delta)
  → Determine tier (999 / 1588 / 3500 / custom)
  → Generate invoice
  → STK Push to yard owner
  → On payment: extend subscription
  → On failure past grace: suspend tenant (read-only or block new transactions)
```

## A.3 Main Business Rules (Consolidated)

| Rule | Enforcement layer |
|------|-------------------|
| No negative weights | API validation + DB CHECK constraint |
| Purchases/sales/payments are immutable | No UPDATE/DELETE on ledger tables; append-only |
| Stock = purchased − sold + adjustments (+ corrections) | Transactional projection update |
| Cannot sell above available stock | Serializable transaction with row lock on stock projection |
| Overpayments blocked | Validation against outstanding balance |
| Partial payment states: unpaid / partial / paid | Derived from payment sum vs. total |
| Corrections are separate records | Event type + reference to original |
| All records scoped by `tenant_id` | RLS + application middleware |
| Default category prices pre-fill but are overridable per transaction | UI default, stored value on transaction |
| Receipts are reproducible from ledger data | Receipt = rendered view of immutable record |

## A.4 Domain Concepts Not in PRD (Must Decide)

| Concept | Recommendation |
|---------|----------------|
| **Cost basis for profit** | Weighted average cost per category per tenant; recalculated on each purchase |
| **Advance allocation** | Supplier credit pool applied FIFO to oldest unpaid purchases |
| **Receipt numbering** | Per-tenant sequential: `{TENANT_PREFIX}-{TYPE}-{YYYYMM}-{SEQ}` |
| **Weight precision** | `NUMERIC(12,3)` — supports grams; display 1–3 decimals per tenant setting |
| **Money precision** | `NUMERIC(14,2)` KES; round half-up at line level |
| **Timezone** | Store UTC; display Africa/Nairobi (EAT, UTC+3) |
| **Single yard per tenant (MVP)** | Include nullable `yard_id` on all operational tables for Phase 2 multi-yard |

---

# B. System Architecture Proposal

## B.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                        │
├──────────────────┬──────────────────────┬───────────────────────────────┤
│  Next.js Web     │  React Native POS    │  Platform Admin Web           │
│  (Owner dashboard│  (CS30 Android)      │  (Super-admin)                │
│   + reports)     │  (Cashier flows)     │                               │
└────────┬─────────┴──────────┬───────────┴───────────────┬───────────────┘
         │                    │                           │
         └────────────────────┼───────────────────────────┘
                              │ HTTPS / WSS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY / LOAD BALANCER                          │
│              (Rate limiting, TLS termination, WAF)                     │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     NestJS API (Stateless)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Auth │ Tenants │ Purchases │ Sales │ Payments │ Stock │ Reports        │
│  M-Pesa Webhooks │ Billing │ Receipts │ Audit                             │
└──────┬──────────────────┬─────────────────────┬─────────────────────────┘
       │                  │                     │
       ▼                  ▼                     ▼
┌──────────────┐  ┌───────────────┐  ┌─────────────────┐
│ PostgreSQL   │  │ Redis         │  │ Job Queue       │
│ (Primary +   │  │ (Cache,       │  │ (BullMQ)        │
│  Read Replica│  │  Sessions,    │  │ Reports,        │
│  future)     │  │  Rate limits) │  │ Billing, M-Pesa │
└──────────────┘  └───────────────┘  └─────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  External: Safaricom Daraja │ Object Storage (PDF receipts) │ Email/SMS  │
└─────────────────────────────────────────────────────────────────────────┘
```

## B.2 Frontend Architecture (Web — Next.js)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering | App Router, RSC for dashboards | Fast initial load for reports |
| Mutations | Server Actions or TanStack Query + REST | Optimistic UI for cashier-speed flows on web |
| State | TanStack Query for server state; Zustand for ephemeral UI | Avoid Redux overhead |
| Forms | React Hook Form + Zod | Shared validation schemas with backend |
| Auth | HTTP-only secure cookies via NextAuth or custom JWT cookie | XSS-resistant |
| Multi-tenancy | Tenant slug in URL: `app.yardflow.co/{tenantSlug}/...` | Clear tenant context |
| Shared packages | `@yardflow/ui`, `@yardflow/types`, `@yardflow/validation` | DRY with POS |

**Web app surfaces:**

1. **Owner dashboard** — stock overview, balances, reports, settings  
2. **Operations console** — purchase/sale entry (backup to POS)  
3. **Platform admin** — separate deploy or route group with super-admin guard  

## B.3 Backend Architecture (NestJS)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Structure | Modular monolith | Right size for MVP; extract services later |
| API style | REST + OpenAPI | Simple for mobile POS; predictable |
| Real-time | SSE or WebSocket for M-Pesa status | Clerk sees payment confirmation without polling |
| Validation | class-validator + shared Zod schemas | Defense in depth |
| ORM | Prisma | Type-safe; good migration story |
| Transactions | Prisma `$transaction` with `Serializable` for stock ops | Prevent oversell |
| Events | Internal event bus (NestJS EventEmitter) → audit + projections | Decouple side effects |
| Idempotency | `Idempotency-Key` header on POST mutations | POS retry safety |

**Core modules:**

```
apps/api/src/
├── auth/
├── tenants/
├── users/
├── suppliers/
├── buyers/
├── categories/
├── ledger/           # purchases, sales, corrections
├── payments/         # supplier + buyer payments
├── inventory/        # stock projections, adjustments
├── mpesa/            # daraja client, webhooks, reconciliation
├── receipts/         # generation, print payloads
├── reports/
├── billing/
├── audit/
└── platform-admin/
```

## B.4 Mobile/POS Architecture (React Native)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target device | CS30 or similar Android handheld | PRD requirement |
| Framework | React Native (Expo bare or prebuild) | Code share with web |
| Offline (MVP) | **Queue-only**: cache pending mutations locally, sync on reconnect | PRD excludes full offline; POS still needs resilience |
| Printing | Native module for ESC/POS over Bluetooth | CS30 thermal printer |
| Auth | Long-lived refresh token + biometric re-auth | Fast clerk login |
| Local storage | SQLite or MMKV for pending transaction queue | Survive app kill |

**POS scope (MVP):** Purchase entry, sale entry, payment entry, receipt print, stock lookup. Reports and settings remain web-only.

## B.5 Multi-Tenant Strategy

**Recommendation: Shared database, shared schema, row-level isolation.**

| Layer | Mechanism |
|-------|-----------|
| Database | `tenant_id UUID NOT NULL` on every tenant-scoped table; composite indexes leading with `tenant_id` |
| PostgreSQL RLS | Policies: `tenant_id = current_setting('app.current_tenant')::uuid` |
| Application | NestJS guard extracts tenant from JWT + validates membership |
| Caching | Cache keys prefixed: `tenant:{id}:...` |
| File storage | Prefix: `tenants/{tenant_id}/receipts/...` |
| M-Pesa | Platform-level Daraja credentials initially; per-tenant shortcode in Phase 2 |
| Migrations | Global schema; no per-tenant DB |

**Why not database-per-tenant?** Operational overhead at 100+ tenants; PostgreSQL RLS is proven at this scale. Revisit at 1000+ tenants or regulatory requirement.

**Tenant provisioning flow:**

1. Platform admin creates tenant → generates `tenant_id`, default categories seeded  
2. Owner invite email → sets password → subscription trial starts  
3. Tenant status: `trial | active | past_due | suspended | cancelled`  

## B.6 API Structure

**Base URL:** `https://api.yardflow.co/v1`

**Tenant scoping:** All tenant routes require `Authorization: Bearer {jwt}` with embedded `tenant_id` and `role`.

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password

GET    /suppliers
POST   /suppliers
GET    /suppliers/:id
GET    /suppliers/:id/ledger
GET    /suppliers/:id/purchases

GET    /buyers
POST   /buyers
GET    /buyers/:id/ledger

GET    /categories
POST   /categories
PATCH  /categories/:id          # name, prices, active flag only

POST   /purchases               # Idempotency-Key required
GET    /purchases
GET    /purchases/:id
POST   /purchases/:id/corrections

POST   /sales
GET    /sales
POST   /sales/:id/corrections

POST   /supplier-payments
POST   /buyer-payments
GET    /payments

GET    /inventory               # current stock by category
GET    /inventory/movements     # event history
POST   /inventory/adjustments

POST   /mpesa/stk-push          # initiate collection
POST   /mpesa/b2c               # initiate payout
POST   /mpesa/callback          # Safaricom webhook (no auth; signature verify)
GET    /mpesa/transactions/:id

GET    /receipts/:id
GET    /receipts/:id/pdf
POST   /receipts/:id/reprint

GET    /reports/daily-purchases
GET    /reports/daily-sales
GET    /reports/stock-valuation
GET    /reports/supplier-balances
GET    /reports/buyer-balances
GET    /reports/profit
GET    /reports/category-performance

GET    /billing/subscription
GET    /billing/invoices
POST   /billing/pay

# Platform admin (separate guard)
GET    /admin/tenants
POST   /admin/tenants
PATCH  /admin/tenants/:id/status
```

**Pagination:** Cursor-based for ledger lists (`?cursor=&limit=50`).  
**Filtering:** `?from=&to=&category_id=&supplier_id=` on transactional endpoints.

## B.7 Authentication Approach

| Aspect | Design |
|--------|--------|
| Protocol | JWT access token (15 min) + refresh token (30 days, rotating) |
| Storage (web) | HTTP-only Secure SameSite=Strict cookies |
| Storage (POS) | Secure enclave / encrypted AsyncStorage |
| Password | bcrypt (cost 12) or argon2id |
| Tenant membership | `user_tenants` join table: user can belong to multiple tenants (future) |
| POS device binding | Optional `device_id` registered to tenant for audit |
| Platform admin | Separate `is_platform_admin` flag; different JWT issuer claim |

## B.8 Role-Based Access Design

Use **RBAC with permission strings**, not hard-coded role checks in business logic.

| Permission | Owner | Cashier | Platform Admin |
|------------|:-----:|:-------:|:--------------:|
| `purchase:create` | ✓ | ✓ | — |
| `sale:create` | ✓ | ✓ | — |
| `payment:create` | ✓ | ✓ | — |
| `inventory:adjust` | ✓ | — | — |
| `correction:create` | ✓ | — | — |
| `report:view` | ✓ | — | — |
| `supplier:manage` | ✓ | — | — |
| `buyer:manage` | ✓ | — | — |
| `category:manage` | ✓ | — | — |
| `user:manage` | ✓ | — | — |
| `settings:manage` | ✓ | — | — |
| `billing:view` | ✓ | — | — |
| `tenant:admin` | — | — | ✓ |

Implementation: `@RequirePermissions('purchase:create')` decorator + guard; permissions loaded from role at login into JWT claims.

---

# C. Database Architecture

## C.1 Entity Relationship Overview

```
tenants ─────────┬──────── users (via user_tenants)
                 │
                 ├──────── suppliers ──── purchases ──── purchase_payments
                 │                              │
                 ├──────── buyers ────────── sales ────── sale_payments
                 │                              │
                 ├──────── scrap_categories ──┬── stock_balances (projection)
                 │                          └── stock_movements (audit trail)
                 │
                 ├──────── ledger_events (append-only event log)
                 ├──────── corrections
                 ├──────── mpesa_transactions
                 ├──────── receipts
                 ├──────── subscriptions / billing_cycles / invoices
                 └──────── audit_logs
```

## C.2 Proposed Entities

### Platform & Identity

**`tenants`**
- `id`, `name`, `slug`, `status`, `timezone`, `currency`, `settings JSONB`, `created_at`

**`users`**
- `id`, `email`, `phone`, `password_hash`, `full_name`, `is_platform_admin`, `created_at`

**`user_tenants`**
- `user_id`, `tenant_id`, `role` (owner|cashier), `is_active`, `created_at`

### Parties

**`suppliers`**
- `id`, `tenant_id`, `full_name`, `phone`, `id_number`, `location`, `notes`, `is_active`
- **`balance_kes`** (projection): amount owed TO supplier

**`buyers`**
- `id`, `tenant_id`, `full_name`, `phone`, `id_number`, `location`, `notes`, `is_active`
- **`balance_kes`** (projection): amount owed BY buyer

### Catalog

**`scrap_categories`**
- `id`, `tenant_id`, `name`, `default_buying_price_per_kg`, `default_selling_price_per_kg`, `is_active`, `sort_order`

### Ledger (Immutable Transaction Records)

**`purchases`**
- `id`, `tenant_id`, `yard_id` (nullable), `supplier_id`, `category_id`
- `weight_kg`, `buying_price_per_kg`, `total_value`, `amount_paid_at_creation`
- `payment_status` (derived/trigger-maintained)
- `created_by`, `created_at`, `idempotency_key`, `notes`
- `correction_of_id` (nullable — if this IS a correction record)

**`sales`**
- Same shape as purchases but `buyer_id`, selling prices

**`purchase_payments`**
- `id`, `tenant_id`, `supplier_id`, `purchase_id` (nullable for unallocated advance)
- `amount`, `payment_method` (cash|mpesa|manual)
- `mpesa_transaction_id` (nullable)
- `created_by`, `created_at`, `idempotency_key`

**`sale_payments`**
- Mirror of purchase_payments for buyer side

**`corrections`**
- `id`, `tenant_id`, `correctable_type`, `correctable_id`
- `weight_delta_kg`, `value_delta_kes`, `reason`, `created_by`, `created_at`

**`stock_adjustments`**
- `id`, `tenant_id`, `category_id`, `weight_delta_kg`, `reason`, `created_by`, `created_at`

### Inventory Projections

**`stock_balances`** (one row per tenant + category)
- `tenant_id`, `category_id`, `weight_kg`, `avg_cost_per_kg`, `version` (optimistic lock)
- Updated atomically inside purchase/sale/adjustment transactions

**`stock_movements`** (append-only audit)
- `id`, `tenant_id`, `category_id`, `movement_type`, `weight_delta_kg`
- `reference_type`, `reference_id`, `running_balance_kg`, `created_at`

### M-Pesa

**`mpesa_transactions`**
- `id`, `tenant_id`, `direction` (inbound|outbound), `amount`, `phone`
- `checkout_request_id`, `merchant_request_id`, `mpesa_receipt_number`
- `status` (pending|confirmed|failed|timeout|reversed)
- `raw_request JSONB`, `raw_callback JSONB`
- `linked_payment_id`, `linked_payment_type`
- `created_at`, `confirmed_at`

### Receipts

**`receipts`**
- `id`, `tenant_id`, `receipt_number`, `receipt_type`, `reference_type`, `reference_id`
- `payload JSONB` (snapshot of printed data), `printed_at`, `print_count`

### Billing

**`subscriptions`**
- `tenant_id`, `plan_tier`, `status`, `current_period_start`, `current_period_end`

**`billing_cycles`**
- `id`, `tenant_id`, `period_start`, `period_end`, `intake_kg`, `tier`, `amount_kes`, `status`

**`invoices`**
- `id`, `tenant_id`, `billing_cycle_id`, `amount_kes`, `status`, `paid_at`

### Audit

**`ledger_events`** (optional unified event store)
- `id`, `tenant_id`, `event_type`, `payload JSONB`, `actor_id`, `created_at`

**`audit_logs`**
- `id`, `tenant_id`, `user_id`, `action`, `entity_type`, `entity_id`, `metadata JSONB`, `ip`, `created_at`

## C.3 Immutable Ledger Strategy

**Pattern: Append-only records + derived projections.**

| Layer | Mutability | Purpose |
|-------|------------|---------|
| `purchases`, `sales`, `*_payments`, `corrections`, `stock_adjustments` | INSERT only | Legal/operational truth |
| `stock_balances`, `suppliers.balance_kes`, `buyers.balance_kes` | UPDATE in transaction | Performance projections |
| `payment_status` on purchases/sales | UPDATE via trigger or app layer | Derived field |

**Correction example:**

Original purchase: 100 kg @ 50 KES/kg = 5000 KES  
Error: should have been 90 kg  

→ Insert `correction` with `weight_delta_kg = -10`, `value_delta_kes = -500`  
→ Insert compensating `stock_movement`  
→ Update `stock_balances.weight_kg -= 10`  
→ Update `supplier.balance_kes -= 500`  

Original purchase row **unchanged**.

**Database enforcement:**

```sql
-- Revoke UPDATE/DELETE on immutable tables from application role
REVOKE UPDATE, DELETE ON purchases, sales, purchase_payments, sale_payments FROM app_role;
-- Corrections only via INSERT through stored procedure or application service
```

## C.4 Inventory Calculation Strategy

**Dual approach (recommended):**

1. **Authoritative projection:** `stock_balances.weight_kg` updated in same DB transaction as purchase/sale  
2. **Verification job:** Nightly reconciliation compares projection vs. `SUM(movements)`; alert on drift  

**Weighted average cost (for profit reports):**

```
On purchase:
  new_avg_cost = (existing_kg × existing_avg_cost + new_kg × purchase_price) / (existing_kg + new_kg)

On sale:
  COGS = sold_kg × avg_cost_at_time_of_sale (store snapshot on sale row: cost_per_kg_at_sale)
```

Store `cost_per_kg_at_sale` on `sales` row at transaction time so profit reports remain stable even if future purchases change avg cost.

## C.5 Transaction Flow Architecture

**Purchase creation (single DB transaction, Serializable isolation):**

```
BEGIN;
  1. INSERT purchase
  2. INSERT stock_movement (type=PURCHASE, delta=+weight)
  3. UPDATE stock_balances SET weight_kg = weight_kg + $weight, avg_cost = recalc(...), version = version + 1
     WHERE tenant_id = $t AND category_id = $c
  4. UPDATE suppliers SET balance_kes = balance_kes + ($total - $paid)
  5. IF paid > 0: INSERT purchase_payment
  6. INSERT ledger_event
  7. INSERT audit_log
COMMIT;
```

**Sale creation:**

```
BEGIN;
  1. SELECT weight_kg, version FROM stock_balances WHERE ... FOR UPDATE
  2. IF weight_kg < sale_weight: ROLLBACK → 409 Insufficient stock
  3. INSERT sale (with cost_per_kg_at_sale from current avg_cost)
  4. INSERT stock_movement (delta=-weight)
  5. UPDATE stock_balances (weight -= sale_weight)
  6. UPDATE buyers SET balance_kes += (total - received)
  7. IF received > 0: INSERT sale_payment
COMMIT;
```

**M-Pesa confirmation (webhook handler):**

```
BEGIN;
  1. SELECT mpesa_transaction WHERE checkout_request_id = $id FOR UPDATE
  2. IF already confirmed: COMMIT (idempotent no-op)
  3. UPDATE mpesa_transaction SET status = confirmed
  4. INSERT payment record
  5. UPDATE party balance
  6. UPDATE purchase/sale payment_status
COMMIT;
```

---

# D. Technical Risk Analysis

## D.1 Stock Corruption Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Oversell due to concurrent sales | **Critical** | `SELECT FOR UPDATE` on `stock_balances`; Serializable isolation |
| Projection drift from event sum | High | Nightly reconciliation job; admin alert |
| Correction after partial sale | **Critical** | Pre-check: `correction_delta + current_stock >= 0`; block or require owner override |
| Direct DB manipulation | Medium | Revoke UPDATE on ledger tables; audit triggers |
| Float rounding in weight | Medium | NUMERIC types; no floating point |
| Category deactivation with stock > 0 | Medium | Block deactivation if stock > 0, or allow but hide from new sales |

## D.2 Concurrent Transaction Risks

| Scenario | Mitigation |
|----------|------------|
| Two clerks sell last 500 kg simultaneously | Row-level lock on `stock_balances`; second transaction fails with clear message |
| Same idempotency key retried | Unique constraint on `(tenant_id, idempotency_key)` → return original response |
| M-Pesa callback duplicated | Idempotent handler keyed on `mpesa_receipt_number` |
| Payment + correction race | Serialize on supplier/buyer balance row |

## D.3 Partial Payment Edge Cases

| Case | Expected behavior | PRD gap |
|------|-------------------|---------|
| Advance exceeds next purchase | Remaining credit stays on supplier account | **Unclear** — define credit pool |
| Pay specific purchase vs. general balance | Support both; general uses FIFO allocation | **Unclear** |
| Partial M-Pesa (customer pays less via STK) | STK is fixed amount; partial only via multiple STK pushes or cash top-up | OK |
| Overpayment attempt | Block at validation | Defined |
| Purchase marked paid, then correction increases value | Revert to partial/unpaid | **Missing** |
| Delete supplier with balance | Block; require balance settlement first | **Missing** |

## D.4 M-Pesa Reliability Risks

| Risk | Mitigation |
|------|------------|
| STK timeout (user doesn't enter PIN) | Status polling job; auto-expire after 2 min; UI retry |
| Callback never arrives | Reconciliation cron using Daraja Transaction Status Query API |
| B2C payout failure after ledger deduction | **Never deduct until confirmed** — payment stays PENDING |
| Wrong phone number | Confirm phone on UI; mask display |
| Platform vs. tenant credentials | MVP: platform Paybill/Till; disburse from platform account |
| Rate limits on Daraja | Queue outbound M-Pesa requests |
| Duplicate `MpesaReceiptNumber` | Unique constraint; idempotent processing |

## D.5 Receipt Printing Concerns

| Risk | Mitigation |
|------|------------|
| Print fails after transaction committed | Transaction is truth; receipt is view — always reprintable |
| CS30 Bluetooth disconnect | Retry print from last receipt ID; cache ESC/POS payload locally |
| 3-second SLA | Pre-render receipt payload server-side; POS only sends bytes to printer |
| Reprint fraud | Log `print_count`; optional owner PIN for reprint |
| Unicode/Swahili characters | Test ESC/POS code page; fallback ASCII |

## D.6 Scaling Risks

| Concern | Threshold | Strategy |
|---------|-----------|----------|
| Ledger table size | 1M+ rows | Index `(tenant_id, created_at)`; archive old data Phase 2 |
| Report query cost | Monthly | Materialized views refreshed hourly; heavy reports async |
| Stock balance hot row | High-frequency category | Row lock contention acceptable at SME scale; shard by category if needed |
| Multi-tenant noisy neighbor | 100+ tenants | Connection pooling (PgBouncer); query timeouts |
| File storage for PDFs | Growth | S3-compatible object storage; lifecycle policy |

## D.7 Additional Architectural Risks

| # | Risk | Impact |
|---|------|--------|
| 1 | Profit report without COGS strategy | Misleading margins |
| 2 | Billing intake includes/excludes corrections undefined | Revenue leakage or overcharge |
| 3 | No offline POS | Lost sales during outage |
| 4 | Single global M-Pesa callback URL | Must route by tenant via account reference |
| 5 | No explicit timezone in PRD | Wrong "daily" reports |
| 6 | Cashier can create suppliers/buyers ad-hoc | Data quality; duplicate detection needed |
| 7 | No fraud controls on weight entry | Internal theft; consider photo capture Phase 2 |
| 8 | Account suspension mid-transaction | Define: complete in-flight, block new |
| 9 | JWT theft on POS | Short access token; device binding |
| 10 | No backup/DR specification | Data loss risk |

---

# E. Infrastructure Proposal

## E.1 Hosting

| Component | Recommendation | Notes |
|-----------|----------------|-------|
| API | **Railway** or **Hetzner Cloud** (Docker) | Cost-effective; Railway for speed, Hetzner for cost at scale |
| Web | **Vercel** (Next.js) or same Docker host | Vercel simplifies Next.js deploy |
| Database | **Managed PostgreSQL** (Railway, Supabase, or DO Managed DB) | Automated backups, PITR |
| Redis | Managed Redis (Upstash or Railway) | Sessions, cache, BullMQ |
| Object storage | **Cloudflare R2** or DO Spaces | PDF receipts |
| CDN | Cloudflare | Static assets, DDoS |

**Environment separation:** `dev` → `staging` → `production` with separate DB and M-Pesa sandbox credentials.

## E.2 Database

- PostgreSQL 16+
- Connection pooling via PgBouncer (transaction mode)
- Extensions: `pgcrypto`, `uuid-ossp`
- Row-Level Security enabled on all tenant tables
- Read replica when report load justifies (Phase 2)

## E.3 Queues & Background Jobs

**BullMQ (Redis-backed):**

| Job | Schedule | Purpose |
|-----|----------|---------|
| `mpesa-reconcile` | Every 5 min | Poll pending M-Pesa transactions |
| `stock-reconcile` | Nightly | Verify projections |
| `billing-generate` | 1st of month | Generate invoices |
| `billing-reminder` | Daily | Payment reminders |
| `report-generate` | On-demand | Heavy PDF/Excel exports |
| `subscription-suspend` | Daily | Suspend past-due tenants |

## E.4 Caching

| Data | TTL | Invalidation |
|------|-----|--------------|
| Category list | 5 min | On category change |
| Stock balances (read) | 30 sec | On any stock mutation |
| Dashboard KPIs | 1 min | On mutation |
| User permissions | Session lifetime | On role change |

**Never cache** ledger writes or payment states beyond read replicas.

## E.5 Backups

| Type | Frequency | Retention |
|------|-----------|-----------|
| Automated DB backup | Daily | 30 days |
| Point-in-time recovery | Continuous WAL | 7 days |
| Logical export | Weekly | 90 days (compliance) |
| Object storage | Versioning enabled | 1 year |

**Restore drill:** Monthly in staging.

## E.6 Monitoring & Observability

| Tool | Purpose |
|------|---------|
| **Sentry** | Error tracking (API + web + POS) |
| **Grafana + Prometheus** or **Datadog** | Metrics, API latency, queue depth |
| **Structured logging** (Pino → Loki or CloudWatch) | Request tracing |
| **Uptime monitoring** | Better Uptime / Pingdom |
| **Alerts** | Stock drift, M-Pesa failure rate, payment queue backlog, DB connections |

**Key metrics:**

- `purchase_created_total`, `sale_created_total` by tenant  
- `stock_insufficient_errors_total`  
- `mpesa_callback_latency_seconds`  
- `mpesa_pending_transactions` (gauge)  
- `billing_invoice_unpaid_total`  

---

# F. Recommended Development Phases

## Phase Overview

```
M1: Foundation     → M2: Core Ledger    → M3: Payments & M-Pesa
        ↓                                        ↓
M4: Receipts & POS ←─────────────────────────────┘
        ↓
M5: Reports → M6: Billing → M7: Hardening & Launch
```

---

## M1: Foundation & Multi-Tenant Core

**Objectives:** Runnable monorepo, auth, tenant isolation, CI/CD, admin seed.

**Modules:**
- Monorepo scaffolding (Turborepo)
- PostgreSQL + Prisma schema (tenants, users, categories)
- NestJS API skeleton with auth (JWT)
- Next.js web shell with login
- Tenant provisioning (platform admin)
- RLS policies
- Docker Compose dev environment
- GitHub Actions CI (lint, test, build)

**Dependencies:** None.

**Risks:**
- RLS complexity with Prisma → test thoroughly; use `$executeRaw` for tenant context `SET LOCAL`

**Acceptance criteria:**
- [ ] Platform admin can create tenant with seeded categories  
- [ ] Owner can log in and see empty dashboard scoped to tenant  
- [ ] Cashier cannot access owner-only routes  
- [ ] Cross-tenant data access returns 404/403  
- [ ] CI pipeline green on PR  

---

## M2: Core Ledger (Purchases, Sales, Inventory)

**Objectives:** Immutable purchase/sale recording with stock integrity.

**Modules:**
- Suppliers CRUD
- Buyers CRUD
- Categories management (owner)
- Purchase service with transactional stock update
- Sale service with stock validation
- Stock balances + movements
- Stock adjustments (owner only)
- Corrections (owner only)
- Basic audit logging

**Dependencies:** M1.

**Risks:**
- Correction edge cases → comprehensive integration tests  
- Concurrent sale tests required before merge  

**Acceptance criteria:**
- [ ] Purchase increases stock; sale decreases stock  
- [ ] Sale blocked when insufficient stock  
- [ ] Concurrent sales: only one succeeds when stock covers one  
- [ ] Corrections create new records; originals unchanged  
- [ ] Supplier/buyer balances update correctly  
- [ ] Payment status derives correctly (unpaid/partial/paid)  
- [ ] Idempotency key prevents duplicate purchases on retry  

---

## M3: Payments & M-Pesa Integration

**Objectives:** Supplier/buyer payments with Safaricom Daraja.

**Modules:**
- Supplier payments (cash, manual, advance, linked)
- Buyer payments (cash, manual, partial)
- M-Pesa STK Push (collections)
- M-Pesa B2C (payouts)
- Webhook handler with idempotency
- Reconciliation background job
- Payment state machine UI (pending → confirmed)

**Dependencies:** M2.

**Risks:**
- Daraja sandbox vs. production parity → test with sandbox early  
- Async UX complexity → WebSocket status updates  

**Acceptance criteria:**
- [ ] Cash/manual payment updates balance immediately  
- [ ] STK Push completes end-to-end in sandbox  
- [ ] Duplicate webhook does not double-count  
- [ ] Pending M-Pesa visible in UI with timeout handling  
- [ ] Overpayment blocked  
- [ ] Advance payment reduces supplier balance without purchase link  

---

## M4: Receipts & POS App

**Objectives:** Thermal printing and cashier mobile workflow.

**Modules:**
- Receipt generation service (JSON → ESC/POS payload)
- PDF receipt generation
- Receipt numbering
- Reprint with audit
- React Native POS app (Android)
- Bluetooth thermal print integration
- POS: purchase, sale, payment, print flows
- Pending mutation queue (network resilience)

**Dependencies:** M2, M3.

**Risks:**
- CS30 hardware availability → obtain device early  
- Bluetooth printing fragmentation → abstract printer adapter  

**Acceptance criteria:**
- [ ] Purchase receipt prints on CS30 in < 3 seconds  
- [ ] PDF receipt downloadable from web  
- [ ] Reprint increments print_count in audit  
- [ ] POS completes full purchase flow online  
- [ ] POS queues mutation when offline; syncs on reconnect without duplicate  

---

## M5: Reports & Owner Dashboard

**Objectives:** Operational visibility and profit tracking.

**Modules:**
- Daily purchases/sales reports
- Stock valuation report
- Supplier/buyer balance reports
- Profit report (with COGS)
- Category performance
- Dashboard KPI cards
- Date range filters
- Export CSV/PDF (async job)

**Dependencies:** M2, M3.

**Risks:**
- Report accuracy depends on COGS → validate with fixture data  
- Heavy queries → materialized views  

**Acceptance criteria:**
- [ ] Daily report matches sum of day's ledger records  
- [ ] Stock valuation = Σ(stock_kg × avg_cost)  
- [ ] Profit = revenue - COGS per sale  
- [ ] Reports scoped to tenant; no cross-tenant leakage  
- [ ] Large report exports do not block API  

---

## M6: SaaS Billing

**Objectives:** Platform monetization via intake-based billing.

**Modules:**
- Subscription management
- Billing cycle computation (monthly intake kg)
- Tier assignment
- Invoice generation
- STK Push for subscription payment
- Payment reminders
- Account suspension (block new transactions)
- Owner billing dashboard

**Dependencies:** M2 (intake data), M3 (STK Push).

**Risks:**
- Intake definition disputes → document formula; include corrections policy  
- Suspension UX → clear messaging, grace period  

**Acceptance criteria:**
- [ ] Monthly intake calculated correctly per tenant  
- [ ] Correct tier applied per PRD pricing bands  
- [ ] Invoice generated on billing date  
- [ ] STK payment activates subscription  
- [ ] Suspended tenant cannot create purchases/sales  
- [ ] Suspended tenant can view historical data  

---

## M7: Hardening, Security & Launch

**Objectives:** Production readiness.

**Modules:**
- Rate limiting
- Security audit
- Load testing (100 concurrent tenants simulation)
- Backup/restore verification
- Error monitoring setup
- Documentation (API, runbooks)
- Staging → production deploy
- Onboarding flow polish

**Dependencies:** All prior milestones.

**Risks:**
- M-Pesa go-live approval timeline  

**Acceptance criteria:**
- [ ] Pen test or OWASP top-10 review complete  
- [ ] Load test: 50 concurrent sale transactions, zero oversells  
- [ ] Backup restore tested  
- [ ] All secrets in vault/env, not in code  
- [ ] Runbook for M-Pesa failure, DB restore, tenant suspension  

---

# G. Suggested Monorepo Structure

```
yardflow/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules
│   │   │   ├── common/         # Guards, filters, interceptors
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   └── Dockerfile
│   │
│   ├── web/                    # Next.js owner/admin dashboard
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (platform)/     # Platform admin routes
│   │   │   └── [tenantSlug]/   # Tenant-scoped app
│   │   ├── components/
│   │   └── Dockerfile
│   │
│   └── pos/                    # React Native Android POS
│       ├── src/
│       │   ├── screens/
│       │   ├── services/
│       │   ├── printer/        # ESC/POS adapter
│       │   └── sync/           # Offline queue
│       └── android/
│
├── packages/
│   ├── types/                  # Shared TypeScript interfaces
│   │   └── src/
│   │       ├── ledger.ts
│   │       ├── inventory.ts
│   │       └── api.ts
│   │
│   ├── validation/             # Shared Zod schemas
│   │   └── src/
│   │       ├── purchase.schema.ts
│   │       ├── sale.schema.ts
│   │       └── payment.schema.ts
│   │
│   ├── api-client/             # Typed fetch client for web + POS
│   │   └── src/
│   │
│   ├── ui/                     # Shared React components (web)
│   │   └── src/
│   │
│   ├── utils/                  # Formatting, currency, dates
│   │   └── src/
│   │       ├── currency.ts
│   │       ├── weight.ts
│   │       └── dates.ts
│   │
│   ├── eslint-config/          # Shared lint rules
│   ├── tsconfig/               # Shared TS configs
│   └── receipt-templates/      # Receipt layout + ESC/POS builders
│       └── src/
│
├── infra/
│   ├── docker-compose.yml      # Local dev (postgres, redis)
│   ├── docker-compose.prod.yml
│   └── scripts/
│       ├── migrate.sh
│       └── seed-dev.sh
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE_REVIEW.md
│   ├── API.md                  # Generated from OpenAPI
│   └── RUNBOOKS.md
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

**Tooling:** pnpm workspaces + Turborepo for build orchestration.

**Why this structure:**
- `apps/` isolates deployable units with independent release cycles  
- `packages/validation` ensures POS and API reject the same bad data  
- `packages/receipt-templates` shared between API (PDF) and POS (thermal)  
- `infra/` keeps Docker out of app folders  

---

# H. Recommended Engineering Standards

## H.1 Testing Strategy

| Layer | Tool | Coverage target |
|-------|------|-----------------|
| Unit | Jest | Business logic: 90%+ |
| Integration | Jest + Supertest + test DB | All ledger mutations |
| E2E (web) | Playwright | Critical owner flows |
| E2E (POS) | Detox (Android) | Purchase + print flow |
| Concurrency | Custom Jest parallel tests | Stock oversell prevention |
| Contract | OpenAPI schema validation | API responses |

**Mandatory test scenarios:**

- Purchase → stock increase → supplier balance  
- Sale with exact stock → success; sale with stock+1 → fail  
- 10 concurrent sales on 500 kg stock, 600 kg total demand → exactly 500 kg sold  
- M-Pesa duplicate callback → single payment  
- Correction reducing purchase below sold weight → blocked  
- Idempotency key replay → same response, no duplicate  

## H.2 Validation Rules

- All inputs validated at API boundary with shared Zod schemas  
- Weight: `> 0`, max 99999 kg per transaction (configurable)  
- Money: `>= 0`, max 2 decimal places  
- Phone: Kenya format `+254...` normalized  
- UUIDs for all IDs (no sequential public IDs — receipt numbers separate)  
- `Idempotency-Key` required on all POST ledger endpoints  

## H.3 Transactional Consistency

- All ledger mutations in Prisma `$transaction`  
- Stock operations use Serializable isolation  
- Outbox pattern for side effects (receipt generation, notifications) if async  
- No distributed transactions; M-Pesa is eventual consistency with explicit PENDING state  

## H.4 Audit Logging

Log every:
- Login/logout/failed login  
- Ledger record creation  
- Correction and adjustment  
- M-Pesa state change  
- Receipt print/reprint  
- User/role change  
- Tenant status change  
- Report export  

Format: `{ timestamp, tenant_id, user_id, action, entity, metadata, ip, user_agent }`

## H.5 API Standards

- REST, JSON, UTF-8  
- ISO 8601 dates in UTC  
- Error format: `{ error: { code, message, details[] } }`  
- HTTP status: 400 validation, 403 forbidden, 404 not found, 409 conflict (stock/idempotency), 422 business rule  
- OpenAPI 3.1 spec auto-generated  
- Version prefix `/v1`  
- Deprecation policy: 6 months notice  

## H.6 Coding Standards

- TypeScript strict mode everywhere  
- ESLint + Prettier (shared config)  
- Conventional Commits  
- PR requires: 1 review, CI green, no migration conflicts  
- No `any` in ledger code  
- Feature flags for M-Pesa and billing in staging  

## H.7 Security Practices

- OWASP top 10 compliance  
- bcrypt/argon2 password hashing  
- Rate limit: 100 req/min per user, 10 login attempts/min per IP  
- CORS: allowlisted origins only  
- M-Pesa callback: IP allowlist + payload validation  
- Secrets in environment/vault; never in repo  
- Dependabot enabled  
- Tenant data export on request; deletion after retention period  
- HTTPS everywhere; HSTS  
- CSP headers on web  

---

# I. UI/UX Operational Recommendations

> **Frozen design system:** [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) (colors, type, spacing, components). **Product flows:** [docs/UI_DIRECTION.md](./docs/UI_DIRECTION.md). This section retains operational workflow detail.

## I.1 Cashier Workflow (POS — Primary)

**Design principle:** Minimum taps from open app to printed receipt.

**Purchase flow (target: ≤ 30 seconds):**

1. **Home screen:** Two big buttons — `BUY IN` / `SELL OUT`  
2. **Supplier:** Search by phone/name → tap result OR `+ New` (name + phone only)  
3. **Category:** Grid of category tiles with current stock badge  
4. **Weight + Price:** Large numeric keypad; price pre-filled from default; total auto-calculates  
5. **Payment:** `Paid in full` / `Partial` / `On credit` — if partial, amount keypad  
6. **Confirm:** Summary screen → `Print & Save`  
7. **Receipt prints immediately;** success screen with `New Purchase` button  

**Sale flow:** Mirror purchase; show **available stock prominently**; warn at < 10% remaining.

## I.2 Stock Flow UX

**Owner web dashboard — Stock panel:**

- Table: Category | Kg on hand | Avg cost | Value | Last movement  
- Color: red if below configurable threshold  
- Click category → movement history timeline (purchases, sales, adjustments)  
- No manual stock edit button — only `Adjust Stock` form with mandatory reason  

## I.3 POS Workflow

- Persistent login with PIN/biometric re-auth after 5 min idle  
- Bottom nav: Purchase | Sale | Pay | Stock | History  
- **Pay tab:** Toggle Supplier/Buyer → search → show balance → pay  
- **History tab:** Today's transactions with reprint button  
- Network indicator: green/yellow/red; pending sync count badge  
- Sound/vibration on M-Pesa confirmation  

## I.4 Low-Friction Purchase Entry

- Remember last 5 suppliers per device  
- Category sort by frequency  
- Barcode scanner support (Phase 2) for category shortcuts  
- Duplicate supplier warning on phone match  
- Quick repeat: "Same as last" for repeat supplier+category  

## I.5 Receipt Printing Flow

- Print triggered client-side with server-rendered ESC/POS payload  
- Receipt includes: tenant name, receipt #, date/time, parties, line items, totals, balance remaining, clerk name, "Powered by YardFlow"  
- Swahili/English toggle (tenant setting)  
- On print failure: modal with `Retry` / `Skip (reprint later)` — transaction already saved  
- QR code on receipt linking to verification URL (Phase 2)  

## I.6 Dashboard Layout (Owner Web)

```
┌─────────────────────────────────────────────────────────────┐
│  YardFlow          [Tenant Name]           [User] [Settings]│
├──────────┬──────────────────────────────────────────────────┤
│          │  Today's Summary                                  │
│  Nav     │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│          │  │ Bought  │ │ Sold    │ │ Profit  │ │ Owed   ││
│  Dash    │  │ 2,400kg │ │ 1,800kg │ │ KES 45k │ │ KES 12k││
│  Stock   │  └─────────┘ └─────────┘ └─────────┘ └────────┘│
│  Buy     │                                                   │
│  Sell    │  Stock Levels          Recent Activity            │
│  Pay     │  [bar chart by cat]    [live feed]                │
│  People  │                                                   │
│  Reports │  Alerts: ⚠ Low Brass (45kg)  ⚠ 3 unpaid > 7 days│
│  Billing │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

- KPI cards for today + month  
- Alert panel: low stock, overdue balances, pending M-Pesa  
- Quick actions: `New Purchase`, `New Sale`, `Record Payment`  

---

# Appendix: PRD Gap Register

Items requiring product decision before or during M2–M3:

| # | Gap | Recommendation | Phase |
|---|-----|----------------|-------|
| 1 | Advance payment allocation rules | FIFO to oldest unpaid purchase; unallocated credit on supplier | M3 |
| 2 | `amount_paid` on purchase vs. derived from payments | Derive from payments; snapshot at creation for receipt only | M2 |
| 3 | Profit / COGS calculation method | Weighted avg cost; snapshot on sale row | M5 |
| 4 | Billing intake includes corrections? | Net intake: purchases minus negative corrections | M6 |
| 5 | Billing tier mid-month crossover | Bill at tier based on end-of-period total; no mid-month upgrade | M6 |
| 6 | Account suspension behavior | Finish pending M-Pesa; block new ledger entries | M6 |
| 7 | Supplier/buyer duplicate detection | Warn on phone number match | M2 |
| 8 | Category deactivation with stock | Block if stock > 0 | M2 |
| 9 | Multi-yard data model | Add nullable `yard_id` now | M1 |
| 10 | Timezone for daily reports | Africa/Nairobi; store UTC | M1 |
| 11 | Weight/money decimal precision | NUMERIC(12,3) kg, NUMERIC(14,2) KES | M1 |
| 12 | M-Pesa credentials scope | Platform-level MVP | M3 |
| 13 | Correction when stock would go negative | Block with message; owner can adjust stock separately | M2 |
| 14 | User invitation flow | Email invite with magic link | M1 |
| 15 | Free trial period | 14-day trial, 999 tier | M6 |
| 16 | Receipt language | English default; Swahili optional | M4 |
| 17 | Cashier supplier create permissions | Allow with minimal fields; owner cleans up | M2 |
| 18 | Sale below cost warning | Warn clerk; allow with confirmation | M2 |
| 19 | Platform admin separate app vs. routes | Route group in web app with super-admin guard | M1 |
| 20 | Data retention policy | Indefinite for ledger; audit 7 years | M7 |
| 21 | Tenant data export | CSV export of ledger on request | M7 |
| 22 | SMS notifications | Phase 2 | — |
| 23 | Offline full mode | Phase 2; MVP queue-only | M4 |

---

## Document Sign-off Checklist

Before implementation begins, stakeholders should confirm:

- [ ] Advance payment and FIFO allocation policy  
- [ ] COGS / profit calculation approach  
- [ ] Billing intake formula including corrections  
- [ ] Account suspension rules  
- [ ] M-Pesa platform vs. per-tenant credentials  
- [ ] Correction behavior when stock would go negative  
- [ ] MVP POS offline scope (queue-only accepted?)  
- [ ] CS30 hardware procured for M4 testing  
- [ ] Safaricom Daraja sandbox credentials available  

---

*This document is the implementation planning baseline. All coding should reference the business rules, transaction patterns, and phase boundaries defined here.*
