# YardFlow — Recovery Functionality Audit

**Date:** 2026-06-05  
**Scope:** Rebuilt system (R1–R5) vs surviving documentation and milestone reports  
**Repo:** `C:\dev\yardflow-rebuild`  
**API tests:** 47/47 passing (R4/R5 baseline)

---

## 1. Executive summary

| Area | Full | Partial | Missing |
|------|------|---------|---------|
| API foundation | 6 | 5 | 6 |
| Core ledger | 8 | 5 | 4 |
| Payments | 5 | 3 | 5 |
| Web UI | 8 | 6 | 6 |
| Design system | 4 | 1 | 2 |
| Deferred (by design) | — | — | 12 |

**Verdict:** Core operational ledger and manual settlement are **substantially recovered**. PRD differentiators (M-Pesa, receipts, POS, billing, Super Admin) are **not recovered**. Web owner ops are **usable**; design quality restored in R5.5.

**Mobile readiness:** **Conditional yes** — API ledger is stable enough for POS read/write flows, but `packages/theme`, suspended-tenant guard, and corrections UI should land in R6 prep before cashier rollout.

---

## 2. Milestone parity

| Original | Rebuild | Parity |
|----------|---------|--------|
| M1 Foundation | R2 | ~85% |
| M2 Core ledger | R3 | ~80% |
| M2.5 Operational UX | R3 + R5 | ~50% API / ~80% web |
| M3 Payments | R4 | ~70% (manual only) |
| M3.5 Web readiness | R5 + R5.5 | ~95% |
| M3.6 Adaptive workspace | R5 + R5.5 | ~90% |
| M4 Native mobile | — | **0%** |

---

## 3. Audit matrix

### 3.1 API foundation

| Area | Original requirement | Rebuilt status | Evidence | Gap | Priority |
|------|---------------------|----------------|----------|-----|----------|
| JWT login | Email/password; tenant slug for yard users | **Full** | `auth.controller.ts`, `auth.service.ts` | — | — |
| Refresh tokens | Rotating hashed refresh; logout revoke | **Full** | `auth.service.ts`, `RefreshToken` model | Multi-tenant refresh picks first membership | P2 |
| JWT claims | tenant_id, role, permissions[] | **Full** | `packages/types/src/permissions.ts`, `jwt.strategy.ts` | — | — |
| Global auth guard | All routes JWT except health/auth | **Full** | `app.module.ts`, `jwt-auth.guard.ts` | — | — |
| Tenant isolation | tenantId from JWT only; cross-tenant → 404 | **Full** | `tenant-membership.guard.ts`, service filters | — | — |
| Permission enforcement | @RequirePermissions on mutations | **Partial** | `permissions.guard.ts` on domain controllers | Many declared permissions have no routes | P1 |
| Platform tenant lifecycle | Create, suspend, status update | **Partial** | `GET/POST /v1/tenants` | No PATCH/suspend | P1 |
| Suspended tenant block | Block ops when suspended | **Missing** | `TenantStatus` enum only | No `@NotSuspended` guard | **P0** |
| PostgreSQL RLS | Defense-in-depth tenant_id RLS | **Missing** | App-layer isolation only | RLS not enabled | P2 |
| Seed data | Platform admin, owner, cashier, demo yard | **Full** | `prisma/seed.ts` | — | — |
| Audit logs | Append on mutations; owner list | **Partial** | `audit.service.ts`, ledger/payment writes | No login audit; party CRUD unaudited | P1 |
| User management | Invite, disable, role change | **Missing** | `GET /users/reports-access` only | No staff CRUD | P1 |
| Health check | Public `/v1/health` | **Full** | `health.controller.ts` | — | — |
| Categories API | List, create, deactivate | **Full** | `categories.controller.ts` | No stock=0 deactivate safety | P1 |

### 3.2 Core ledger

| Area | Original requirement | Rebuilt status | Evidence | Gap | Priority |
|------|---------------------|----------------|----------|-----|----------|
| Suppliers / buyers | CRUD + balances | **Partial** | `GET/POST` controllers | No PATCH/deactivate | P1 |
| Purchases | Append-only create/list/detail | **Full** | `purchases.service.ts`, validation schemas | — | — |
| Sales | Append-only + COGS snapshot | **Full** | `sales.service.ts`, schema fields | — | — |
| Stock balances / movements | Weighted avg trail | **Full** | `inventory.controller.ts` | — | — |
| Stock adjustments | Owner signed delta + audit | **Partial** | `POST /inventory/adjustments` | No list; no web UI | P2 |
| Corrections | Purchase/sale corrections | **Partial** | `corrections.controller.ts` | No preview; no web UI | P1 |
| SELECT FOR UPDATE | Row locking before mutation | **Full** | `ledger-transaction.service.ts`, `payment-allocation.service.ts` | — | — |
| Oversell blocking | 409 on insufficient stock | **Full** | `STOCK_INSUFFICIENT`, e2e tests | — | — |
| Weighted-average COGS | Snapshot at sale; never recomputed | **Full** | `ledger-math.ts`, `@yardflow/utils` | — | — |
| Idempotency | Unique tenant + idempotency_key | **Full** | Schema + ledger service | — | — |
| Ledger events | Same-TX domain events | **Partial** | `ledger-events.service.ts` | Naming drift vs docs; no M-Pesa events | P3 |
| Server pagination/filters | List-query contract (M2.5) | **Missing** | Plain array responses | Web uses client pagination | P1 |
| Dashboard overview API | `GET /dashboard/overview` | **Missing** | No dashboard module | Web composes 7 fetches | P2 |
| Party balance projections | balanceKes on transactions | **Full** | `ledger-transaction.service.ts` | — | — |
| Decimal types | NUMERIC for money/weight | **Full** | Prisma `Decimal` | — | — |
| Reconciliation jobs | Drift detection | **Missing** | Not in codebase | Scheduled checks absent | P3 |

### 3.3 Payments

| Area | Original requirement | Rebuilt status | Evidence | Gap | Priority |
|------|---------------------|----------------|----------|-----|----------|
| Supplier payments | Manual FIFO allocate | **Full** | `supplier-payments.controller.ts`, allocation service | — | — |
| Buyer payments | FIFO; reject overpay | **Full** | `buyer-payments.controller.ts`, 422 on overpay | — | — |
| FIFO allocation | Oldest unpaid first | **Full** | `payment-allocation.service.ts`, 15 e2e scenarios | — | — |
| Supplier credit pool | Overpay → credit on purchase | **Full** | `creditBalanceKes`, `applySupplierCreditOnPurchase` | — | — |
| Payment status | unpaid/partial/paid derived | **Full** | `derivePaymentStatus` in `ledger-math.ts` | List rows omit remainingKes | P2 |
| Balance summary | Yard-wide owed/credit/receivable | **Full** | `balances.controller.ts` | — | — |
| Payment idempotency | Per-tenant unique keys | **Full** | `payment-allocation.service.ts` | — | — |
| Creation-time payment | Pay at purchase/sale create | **Missing** | Schemas lack amountPaidKes | Separate payment step only | P2 |
| M-Pesa | STK, B2C, webhooks | **Missing** | No mpesa module/table | PRD differentiator | **P0** |
| Payment reversal | Compensating entries | **Missing** | `reversed` enum unused | Manual workaround only | P2 |
| Receipts on payment | Generate on confirm | **Missing** | No receipts model | — | **P0** |
| Concurrent payment safety | FOR UPDATE on party | **Full** | Payment service locks | — | — |

### 3.4 Web UI

| Area | Original requirement | Rebuilt status | Evidence | Gap | Priority |
|------|---------------------|----------------|----------|-----|----------|
| Login + session | IBM split login; 401 redirect | **Full** | `login/page.tsx`, `auth-context.tsx` | Memory/localStorage tokens | P3 |
| Tenant shell + nav | Permission-gated sidebar | **Full** | `tenant-shell.tsx` — grouped nav + Lucide | — | — |
| Command header | Search, quick actions, user menu | **Full** | `command-header.tsx` | — | — |
| Dashboard | Command center KPIs, intel, activity | **Full** | `dashboard/page.tsx` (R5.5 hero row) | Client-side aggregation | P2 |
| Party workspaces | Drawer + quick pay/receive | **Full** | `party-workspace.tsx` | — | — |
| Ledger workspaces | Forms + settlement drawer | **Full** | `ledger-workspace.tsx` | — | — |
| Inventory workspace | Stock + movements | **Full** | `inventory-workspace.tsx` | — | — |
| Categories | Create + deactivate | **Partial** | `categories-workspace.tsx` | No inline edit | P2 |
| Balances page | Settlement summary | **Full** | `balances-workspace.tsx` | — | — |
| Audit page | Owner read-only | **Full** | `audit/page.tsx` | — | — |
| Settings | Tenant context | **Partial** | `settings/page.tsx` | No settings API wiring | P2 |
| 70/30 workspace + drawers | Operational UX | **Full** | `workspace-layout.tsx`, `detail-drawer.tsx` | Client pagination only | P2 |
| Global search | Scoped search API | **Partial** | `global-search.tsx` UI | No backend search | P2 |
| Corrections UI | Owner correction workflow | **Missing** | API only | No web workflow | P1 |
| Stock adjustment UI | Physical count fixes | **Missing** | API only | No web form | P2 |
| Reports / export | Profit, intake reports | **Missing** | No report routes | — | P1 |
| Receipt print/reprint | Thermal/PDF | **Missing** | No print flows | — | **P0** |
| Native POS UX | Bottom nav, receipt-first | **Missing** | No `apps/pos` | M4 not recovered | **P0** |
| Super Admin UI | Platform tenant/billing | **Missing** | No `/admin` routes | — | P2 |
| Billing UI | Subscription pay | **Missing** | No billing pages | — | P1 |

### 3.5 Design system

| Area | Original requirement | Rebuilt status | Evidence | Gap | Priority |
|------|---------------------|----------------|----------|-----|----------|
| Frozen palette & tokens | DESIGN_SYSTEM v1.0 | **Full** | `globals.css`, `docs/DESIGN_SYSTEM.md` (restored R5.5) | — | — |
| Inter typography | Professional type hierarchy | **Full** | `layout.tsx`, CSS type scale | — | — |
| Lucide icons | Professional icon pack | **Full** | `lucide-react`, `icon.tsx` (R5.5) | — | — |
| IBM login | Split panel restraint | **Full** | `login/page.tsx` (R5.5) | — | — |
| Command center dashboard | Hero KPI + quick actions | **Full** | `dashboard/page.tsx` (R5.5) | — | — |
| Shared theme package | `packages/theme` for POS | **Missing** | Not in monorepo | Needed for mobile parity | P1 |
| CS30 receipt layout | Thermal print spec | **Missing** | No print code | — | P0 |
| Cross-platform semantic colors | Web → POS consistency | **Partial** | Web complete | POS absent | P2 |

### 3.6 Missing / deferred (explicit backlog)

| Area | Original requirement | Rebuilt status | Evidence | Gap | Priority |
|------|---------------------|----------------|----------|-----|----------|
| Native POS (`apps/pos`) | Expo RN cashier app (M4) | **Missing** | 0 files | Entire M4 lost | **P0** |
| M-Pesa module | Daraja integration | **Missing** | No API/schema | — | **P0** |
| Receipts module | Generate/print/reprint | **Missing** | No model | — | **P0** |
| Billing / SaaS | Intake-based subscription | **Missing** | No billing tables | — | P1 |
| Platform admin ops | Suspend/reactivate tenants | **Missing** | Tenants POST/GET only | — | P1 |
| User invite / roles | Owner staff management | **Missing** | No endpoints | — | P1 |
| Party deactivate | Soft deactivate API | **Missing** | No routes | — | P1 |
| Correction preview | Impact before confirm | **Missing** | — | — | P2 |
| Offline POS queue | M4 offline scaffold | **Missing** | No POS app | — | P2 |
| Server pagination | M2.5 list-query | **Missing** | Client-side only | Breaks at scale | P1 |
| WhatsApp/OCR/exports | Phase 2 PRD | **Deferred** | — | Post-MVP | P3 |

---

## 4. Fully restored areas

- JWT auth with refresh rotation and permission guards
- Tenant-scoped ledger: purchases, sales, stock, movements, COGS
- Concurrency protection (`SELECT FOR UPDATE`) and oversell blocking
- Manual payment settlement: FIFO, supplier credit, buyer overpay rejection
- Balance summary and party settlement detail endpoints
- Owner web: dashboard, all operational workspaces, drawers, payments
- Frozen design system tokens + Lucide icons + IBM login (R5.5)
- 47 API integration tests green

---

## 5. Partially restored areas

- Audit logging (ledger/payments yes; login/parties incomplete)
- Corrections and stock adjustments (API yes; web no)
- Categories and parties (create yes; update/deactivate incomplete)
- Global search (UI yes; API no)
- List endpoints (functional but unpaginated)
- Platform tenant management (create/list only)
- Permission matrix (declared > implemented)

---

## 6. Missing areas (not rebuilt)

- M-Pesa (STK, B2C, callbacks)
- Receipts and CS30 thermal printing
- Native mobile / POS app (`apps/pos`)
- Billing, subscriptions, invoices
- Super Admin web console
- User/staff management API
- Suspended tenant enforcement
- PostgreSQL RLS
- Reports and exports

---

## 7. Recommended next milestone

### Option A — R6 Native mobile (recommended if cashier UX is priority)

1. Extract `packages/theme` from `globals.css`
2. Restore `apps/pos` Expo shell (M4 report as spec)
3. Buy/sell/pay flows against existing R3/R4 API
4. Add `@NotSuspended` guard (P0)

### Option B — R6 M-Pesa + receipts (recommended if payment automation is priority)

1. `mpesa_transactions` schema + webhook handlers
2. Receipts model + print confirmation UI
3. Wire payment confirm → receipt generate

### Parallel P1 (either path)

- Server-side list pagination
- Corrections + adjustment web UI
- User invite API

---

## 8. Can mobile safely begin?

| Criterion | Status | Notes |
|-----------|--------|-------|
| Ledger API stable | ✅ Yes | 47 tests; locking verified |
| Payment API stable | ✅ Yes | FIFO + credit pool tested |
| Auth for cashier role | ✅ Yes | CASHIER_PERMISSIONS defined |
| Design tokens for POS | ⚠️ No | Need `packages/theme` first |
| Receipt print flow | ❌ No | Blocker for POS completion |
| M-Pesa | ❌ No | Manual payments only — acceptable for MVP POS |
| Suspended tenant guard | ❌ No | Add before production |

**Answer:** Mobile **foundation** (shell, nav, read stock, record purchase/sale) can begin now. Mobile **production-ready POS** should wait for theme package + receipt flow + suspended guard.

---

*Audit based on documentation and source inspection of `C:\dev\yardflow-rebuild` as of 2026-06-05.*
