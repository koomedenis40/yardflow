# YardFlow — Project Handover (R5.6)

**Date:** 2026-06-05  
**Repository:** https://github.com/koomedenis40/yardflow.git  
**Local clone (recovery rebuild):** `C:\dev\yardflow-rebuild`  
**Purpose:** Complete handover so another AI session or IDE can continue YardFlow without losing context.

---

## 1. Executive Summary

### What YardFlow is

YardFlow is a **multi-tenant scrap yard operations and stock management platform**. It records purchases from suppliers, sales to buyers, stock by kilogram with weighted-average COGS, manual payment settlement (FIFO allocation, supplier credit pool), and balance projections — designed for small-to-medium scrap dealers, primarily in Kenya.

### Business purpose

Replace notebooks, WhatsApp, and memory-based tracking with a reliable operational ledger: stock integrity, payment disputes resolved, supplier/buyer balances visible, and profit traceable.

### Current recovery status

YardFlow suffered a **source-code loss incident** (June 2026). Recovery was executed as a staged rebuild (R1–R5) from surviving documentation, milestone reports, and architectural contracts. The rebuilt system is **functionally operational** for owner web use and API-driven POS/mobile integration.

| Milestone | Status | Summary |
|-----------|--------|---------|
| R1 | ✅ Complete | Monorepo scaffold + shared packages (`types`, `validation`, `utils`) |
| R2 | ✅ Complete | NestJS API foundation (auth, tenancy, categories, audit, health) |
| R3 | ✅ Complete | Core ledger (suppliers, buyers, purchases, sales, inventory, corrections API) |
| R4 | ✅ Complete | Payments & balances (FIFO, credit pool, balance summary) |
| R5 | ✅ Complete | Operational owner web UI (workspaces, drawers, dashboard) |
| R5.5 | ✅ Complete | Design restoration + recovery functionality audit |
| R5.6 | ✅ Complete | UI/product quality audit and refinement |

**API tests:** 47/47 passing at R5.6 ship.  
**Not recovered:** native mobile (`apps/pos`), M-Pesa, receipts/CS30, billing, Super Admin.

### Current milestone

**R5.6 is complete and pushed.** Next recommended milestone is **R6 — Native Mobile Foundation** (see §9).

---

## 2. Architecture

### 2.1 Monorepo layout

```
yardflow/
├── apps/
│   ├── api/          # NestJS REST API (port 3001, prefix /v1)
│   └── web/          # Next.js 15 owner dashboard (port 3000)
├── packages/
│   ├── types/        # Shared TypeScript types, enums, permissions
│   ├── validation/   # Zod schemas (single source of truth for API input)
│   └── utils/        # Pure functions: COGS, FIFO, money, weight
├── docs/             # System contracts + design system
├── infra/            # Docker Compose (PostgreSQL)
├── prisma/           # (inside apps/api) schema + migrations + seeds
└── *.md              # Milestone reports, audits, PRD
```

**Note:** `apps/pos` (native mobile) and `packages/theme` existed in pre-loss M4 but are **not present** in the current rebuild. `M4_NATIVE_MOBILE_FOUNDATION_REPORT.md` is the spec to rebuild them in R6.

### 2.2 Backend — NestJS + Prisma + PostgreSQL

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | NestJS 10 | Global prefix `v1`, CORS from env |
| ORM | Prisma 6 | Schema at `apps/api/prisma/schema.prisma` |
| Database | PostgreSQL 16 | Docker on host port **5434** |
| Auth | JWT + Passport | Access + rotating refresh tokens |
| Validation | `@yardflow/validation` (Zod) | Controllers pass `unknown` → service parses |
| Tests | Jest unit + e2e | 47 tests; e2e uses shared dev DB (see §8) |

#### Key API modules (`apps/api/src/`)

| Module | Path prefix | Responsibility |
|--------|-------------|----------------|
| `auth` | `/v1/auth` | Login, refresh, logout, me |
| `tenants` | `/v1/tenants` | Platform tenant create/list |
| `users` | `/v1/users` | Reports access check only |
| `categories` | `/v1/categories` | Scrap category CRUD (deactivate) |
| `suppliers` | `/v1/suppliers` | List, create, detail with unpaid/payments |
| `buyers` | `/v1/buyers` | List, create, detail with unpaid/payments |
| `purchases` | `/v1/purchases` | Create (ledger), list, detail |
| `sales` | `/v1/sales` | Create (ledger), list, detail |
| `inventory` | `/v1/inventory` | Stock balances, movements, adjustments |
| `corrections` | `/v1/corrections` | Purchase/sale corrections |
| `supplier-payments` | `/v1/supplier-payments` | Manual supplier settlement |
| `buyer-payments` | `/v1/buyer-payments` | Manual buyer collection |
| `balances` | `/v1/balances` | Summary + per-party balances |
| `audit` | `/v1/audit/logs` | Owner read-only audit trail |
| `health` | `/v1/health` | Public health check |

#### Auth architecture

1. **Login** (`POST /v1/auth/login`): email + password + `tenantSlug` for yard users; platform admin can omit tenant.
2. **JWT payload** carries `userId`, `tenantId`, `tenantSlug`, `role`, `permissions[]`, `isPlatformAdmin`.
3. **Global guard** (`JwtAuthGuard` in `app.module.ts`): all routes JWT-protected except `@Public()` (health, auth).
4. **Permission guard** (`@RequirePermissions`): enforced on mutation endpoints; permissions from `@yardflow/types` (`OWNER_PERMISSIONS`, `CASHIER_PERMISSIONS`).
5. **Refresh rotation**: hashed refresh tokens in DB; logout revokes.
6. **Web client**: tokens in `auth-context.tsx`; 401 triggers redirect to login.

#### Tenancy architecture

1. **Tenant isolation**: `tenantId` always from JWT — never from request body/query.
2. **Membership guard**: validates user belongs to tenant in token.
3. **Data scoping**: all Prisma queries filter `where: { tenantId }`.
4. **Cross-tenant access**: returns 404 (not 403) to avoid leaking existence.
5. **Gaps**: no suspended-tenant block guard; no PostgreSQL RLS (app-layer only).

#### Ledger architecture

**Core service:** `ledger-transaction.service.ts`

- **Purchases**: increment supplier `balanceKes`, update stock (weighted average COGS), record movement, apply supplier credit pool if available.
- **Sales**: decrement stock (reject oversell with 409), snapshot COGS at sale time, increment buyer `balanceKes`.
- **Concurrency**: `SELECT FOR UPDATE` on stock balance and party rows inside Prisma transactions.
- **Idempotency**: unique `(tenantId, idempotencyKey)` on purchases/sales/payments.
- **Corrections**: API exists; no web UI yet.
- **Stock adjustments**: API exists; no web UI yet.
- **Events + audit**: ledger events and audit logs written in same transaction for mutations.

**Math:** `ledger-math.ts` + `@yardflow/utils` (COGS, FIFO helpers, money/weight formatting).

#### Payment architecture

**Core service:** `payment-allocation.service.ts`

- **Supplier payments**: FIFO over oldest unpaid purchases; optional `purchaseId` for targeted pay; overpay → `creditBalanceKes` on supplier.
- **Buyer payments**: FIFO over unpaid sales; **rejects overpayment** (422).
- **Allocation rows**: `PaymentAllocation` links payment source → purchase/sale target.
- **Status derivation**: `unpaid` / `partial` / `paid` computed from allocated amounts.
- **Methods**: `cash`, `bank`, `mobile_money_manual`, `other_manual` (manual only — no Daraja/M-Pesa).
- **Gaps**: no payment reversal, no creation-time payment on purchase/sale, no receipts.

### 2.3 Frontend — Next.js web

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Next.js 15 (App Router) | React 19 |
| Styling | CSS variables in `globals.css` | Frozen design system |
| Icons | Lucide React via `icon.tsx` | 20px inline, 1.75px stroke |
| Font | Inter (`next/font`) | Applied via `layout.tsx` |
| State | React context | `auth-context.tsx` for session |
| API client | `lib/api.ts` | `apiFetch` → `http://localhost:3001/v1` |

#### Web route structure (`apps/web/src/app/`)

| Route | Page | Component |
|-------|------|-----------|
| `/login` | Login | IBM split-panel login |
| `/[tenantSlug]/dashboard` | Command center | KPIs, intel, activity feeds |
| `/[tenantSlug]/purchases` | Purchases workspace | `LedgerWorkspace` (purchase mode) |
| `/[tenantSlug]/sales` | Sales workspace | `LedgerWorkspace` (sale mode) |
| `/[tenantSlug]/suppliers` | Suppliers | `PartyWorkspace` (supplier) |
| `/[tenantSlug]/buyers` | Buyers | `PartyWorkspace` (buyer) |
| `/[tenantSlug]/inventory` | Stock | `InventoryWorkspace` |
| `/[tenantSlug]/categories` | Categories | `CategoriesWorkspace` |
| `/[tenantSlug]/balances` | Settlement | `BalancesWorkspace` |
| `/[tenantSlug]/audit` | Audit log | Paginated table |
| `/[tenantSlug]/settings` | Settings | Minimal tenant context |

#### Shell components

- **`tenant-shell.tsx`**: sidebar nav (grouped sections, Lucide icons, permission-gated links).
- **`command-header.tsx`**: page title, global search, notifications placeholder, quick actions, user menu.
- **`workspace-layout.tsx`**: 70/30 split (primary table + secondary action panel).
- **`detail-drawer.tsx`**: right-side detail panel on row click.
- **`operational-table.tsx`**: sortable dense table.
- **`pagination-bar.tsx`**: client-side pagination controls.

### 2.4 Shared packages

#### `@yardflow/types`

- Enums: `PAYMENT_STATUS`, `PAYMENT_METHOD`, `MOVEMENT_TYPE`, `USER_TENANT_ROLE`, etc.
- `AuthUser`, `JwtPayload`, `AuthMeResponse`
- `OWNER_PERMISSIONS`, `CASHIER_PERMISSIONS`, `PLATFORM_ADMIN_PERMISSIONS`
- `DEFAULT_SCRAP_CATEGORIES` (seed category names)
- Entity interfaces

#### `@yardflow/validation`

- Zod schemas for every API input: `createPurchaseSchema`, `createSaleSchema`, `createSupplierPaymentSchema`, etc.
- Reuses enum tuples from `@yardflow/types` to prevent drift.

#### `@yardflow/utils`

- `cogs.ts` — weighted average cost calculation
- `fifo.ts` — allocation ordering helpers
- `money.ts`, `weight.ts` — formatting/parsing
- `date.ts`, `receipt.ts`, `billing.ts` — stubs for future features

### 2.5 Patterns to follow

1. **Validation at service boundary**: `schema.safeParse(body)` → `BadRequestException` on failure.
2. **Idempotency on all mutations**: client sends `idempotencyKey` (UUID); server returns existing row on duplicate.
3. **Tenant from JWT only**: never trust client-supplied `tenantId`.
4. **Decimal in DB, number in API responses**: Prisma `Decimal` converted via `toNum()` helpers.
5. **Web lists**: fetch full array (max 100), paginate/sort/filter client-side (temporary).
6. **Design changes**: update `docs/DESIGN_SYSTEM.md` first, then `globals.css`.

---

## 3. Current Functionality Matrix

| Area | Status | Notes |
|------|--------|-------|
| **Auth** | ✅ Implemented | JWT login/refresh/logout; owner + cashier roles; platform admin |
| **Tenants** | ⚠️ Partial | Create + list; no suspend/PATCH/status workflow |
| **Users** | ❌ Missing | No invite, disable, or role-change API |
| **Suppliers** | ⚠️ Partial | List, create, detail, pay; no PATCH/deactivate |
| **Buyers** | ⚠️ Partial | List, create, detail, collect; no PATCH/deactivate |
| **Purchases** | ✅ Implemented | Create, list, detail, stock + balance side effects |
| **Sales** | ✅ Implemented | Create, list, detail, COGS snapshot, oversell block |
| **Inventory** | ✅ Implemented | Stock balances, movements list, adjustments API |
| **Stock Movements** | ✅ Implemented | Auto-recorded on purchase/sale/correction/adjustment |
| **Corrections** | ⚠️ Partial | API only; no web workflow or preview |
| **Adjustments** | ⚠️ Partial | API only; no web form |
| **Payments** | ✅ Implemented | Manual FIFO, credit pool, overpay rejection; no M-Pesa |
| **Balances** | ✅ Implemented | Summary + per-party owed/credit/receivable |
| **Dashboard** | ✅ Implemented | Client-composed from 7 API calls; KPIs + activity |
| **Audit** | ⚠️ Partial | Owner list view; incomplete coverage (login/parties) |
| **Settings** | ⚠️ Partial | Static page; no settings API wiring |
| **Global search** | ⚠️ Partial | UI popover with scopes; **no backend** (shows "coming soon") |
| **Categories** | ⚠️ Partial | Create + deactivate; no inline edit |
| **Receipts** | ❌ Missing | No model, no print |
| **M-Pesa** | ❌ Missing | No Daraja integration |
| **Native mobile** | ❌ Missing | `apps/pos` not in rebuild |
| **Billing** | ❌ Missing | No subscription tables |
| **Super Admin** | ❌ Missing | No `/admin` routes |

---

## 4. Recovery Audit Summary

### Successfully recovered

- Full NestJS API with auth, tenancy, permissions
- Core ledger: purchases, sales, stock, movements, weighted-average COGS
- Concurrency protection (`SELECT FOR UPDATE`) and oversell blocking
- Manual payment engine: FIFO, supplier credit pool, buyer overpay rejection
- Balance projections and settlement detail endpoints
- Owner web: dashboard, all operational workspaces, drawers, payment actions
- Frozen design system + Lucide icons + IBM login (R5.5)
- 47 API integration tests green
- Realistic demo seed script (R5.6)

### Reconstructed (not original source)

- Entire `apps/api` and `apps/web` codebase from docs + reports
- `docs/DESIGN_SYSTEM.md` (re-created in R5.5 from surviving context)
- `apps/api/prisma/demo-seed.ts` (new in R5.6)
- Milestone reports R1–R5.6

### Remains missing (by design or not yet rebuilt)

| Feature | Priority | Reference |
|---------|----------|-----------|
| Native mobile (`apps/pos`) | P0 | `M4_NATIVE_MOBILE_FOUNDATION_REPORT.md` |
| M-Pesa (STK, B2C, webhooks) | P0 | PRD §payments |
| Receipts + CS30 thermal print | P0 | PRD §receipts |
| Billing / SaaS subscriptions | P1 | PRD §billing |
| Super Admin console | P2 | PRD §platform |
| `packages/theme` for POS parity | P1 | M4 report |
| Suspended tenant guard | P0 | `RECOVERY_FUNCTIONALITY_AUDIT.md` |
| Server-side pagination | P1 | M2.5 contract |
| User/staff management | P1 | PRD §users |
| Corrections/adjustments web UI | P1 | API exists |

---

## 5. Design System

**Canonical doc:** `docs/DESIGN_SYSTEM.md` (frozen v1.0)  
**Implementation:** `apps/web/src/app/globals.css`  
**Product flows:** `docs/UI_DIRECTION.md`

### Typography (Inter)

| Token | Size | Use |
|-------|------|-----|
| `--text-display` | 2rem | Login headline |
| `--text-h1` | 1.5rem | Page title (command header) |
| `--text-h2` | 1.125rem | Panel titles |
| `--text-h3` | 0.9375rem | Section labels, drawer headings |
| `--text-body` | 0.875rem | Body, table cells |
| `--text-body-sm` | 0.8125rem | Secondary meta |
| `--text-caption` | 0.75rem | KPI labels, table headers |
| `--text-kpi` | 1.75rem | KPI values |
| `--text-kpi-lg` | 2.25rem | Hero stock KPI |

### Spacing

4px base grid: `--space-1` (4) through `--space-8` (32). Page padding `--space-6`/`--space-8`. Card padding `--space-4`/`--space-5`.

### Colors (semantic)

| Role | Token | Hex |
|------|-------|-----|
| Canvas | `--canvas` | `#f7f8fa` |
| Surface | `--surface` | `#ffffff` |
| Text | `--text` | `#161616` |
| Muted | `--muted` | `#8d9196` |
| Purchase/stock/success | `--green` / `--green-featured` | `#146b4d` / `#0e4f3a` |
| Sale/info | `--blue` / `--focus` | `#0043ce` / `#0f62fe` |
| Warning/partial | amber tokens | `#fcf4d6` bg |
| Danger | `--red` | `#da1e28` |
| Sidebar | `--sidebar` | `#f4faf7` |

**Rule:** white text/icons on green-800+ and blue-700+ backgrounds.

### Layout rules

- **App shell:** fixed sidebar (252px) + main column.
- **Page content:** max-width 1440px default; **1680px** ≥1680px; **1840px** ≥1920px (R5.6).
- **Workspace:** 70/30 grid (`workspace__split`); secondary collapses below 1100px.
- **Dashboard:** hero row (featured stock KPI + intake/sales stack + quick actions) → financial KPIs → intel grid → activity grid → category strip.

### Sidebar behavior

- Grouped nav: Operations, Parties, Finance, System.
- Lucide icons, semantic active tones (green/blue/neutral).
- **Hidden below 1100px** — no mobile drawer yet (R6/mobile handles this).

### Command header behavior

- Three-column grid: title | search | actions (notifications, quick actions, user menu).
- Collapses to single column below 1100px.

### Search behavior (R5.5 + R5.6)

- **Scopes hidden until focus/click** — shown in elevated popover.
- Scopes: All, Suppliers, Buyers, Purchases, Sales, Categories.
- `Ctrl/⌘+K` focuses; `Esc` and click-outside close.
- **Backend not implemented** — hint text says integration coming soon (`buildSearchApiPath` returns `null`).

### Drawer behavior (R5.6)

- Right-side overlay with blur backdrop.
- Structured `drawer-stats` card grid for settlement/balances/stock.
- `drawer-rows` for allocations, unpaid items, payments, movements (not raw bullets).
- Signed weight deltas (green in / red out) on inventory movements.

### Table behavior

- Dense operational table: sortable columns, row click → drawer.
- Caption-style uppercase headers, muted color.
- Selected row highlight.

### Pagination behavior (R5.6)

- Client-side via `paginateClient()` in `lib/types.ts`.
- `PaginationBar` with page size selector and chevron prev/next.
- Present on: purchases, sales, suppliers, buyers, inventory, **audit** (added R5.6).
- Balances tables pre-filter to non-zero rows (typically short).
- API still returns max 100 rows (`take: 100`) — no server pagination.

### R5.5 design decisions

- Lucide React as sole icon library (no emoji/unicode).
- IBM-style split login panel.
- Command-center dashboard with featured black/green stock KPI.
- Mint sidebar wash, restrained industrial palette.
- Inter font applied globally via `inter.className`.

### R5.6 design decisions

- Focus-triggered search popover (scopes no longer always visible).
- Recent payments show party + type + amount + method + day/time.
- Drawer content as structured cards/rows.
- Audit pagination added.
- Wide-desktop content widening.
- `formatMethod()` and `formatDayTime()` display helpers.

---

## 6. Seed Data

### Base seed (`pnpm db:seed`)

Creates users, tenants, and default scrap categories. **No transactional data.**

| Entity | Value |
|--------|-------|
| Platform admin | `admin@yardflow.local` / `Password123!` |
| Demo tenant | slug: `demo-yard`, name: Demo Yard |
| Other tenant | slug: `other-yard` (isolation testing) |
| Owner | `owner@demo.local` / `Password123!` |
| Cashier | `cashier@demo.local` / `Password123!` |
| Categories | `DEFAULT_SCRAP_CATEGORIES` from `@yardflow/types` (~20 scrap grades) |

### Demo seed (`pnpm --filter @yardflow/api run seed:demo`)

**Requires API running.** Clears demo tenant transactional data and regenerates realistic operations via HTTP (production ledger/payment code).

| Entity | Count | Examples |
|--------|-------|---------|
| Suppliers | 8 | Mary Wanjiku, Peter Otieno, James Mwangi, Amina Hassan, Brian Kiptoo, Grace Njeri, Samuel Kamau, Fatuma Ali |
| Buyers | 6 | Nairobi Metals Ltd, Eastlands Recycling, GreenCycle Traders, Ruiru Scrap Buyers, Mombasa Steel Co, Thika Alloys Ltd |
| Purchases | 18 | Realistic weights/prices across 8 trade categories |
| Sales | 12 | Believable sell prices, partial stock consumption |
| Payments | Mixed | Full/partial/unpaid balances; cash, mobile money, bank |

**Category pricing** set to realistic KES/kg (e.g. Copper 640/720, Steel 25–30 buy).

### Login credentials (demo)

```
URL:        http://localhost:3000/login
Email:      owner@demo.local
Password:   Password123!
Tenant:     demo-yard
Dashboard:  http://localhost:3000/demo-yard/dashboard
```

Cashier login: `cashier@demo.local` / `Password123!` / `demo-yard`

---

## 7. Commands

### Prerequisites

- Node.js ≥ 20
- pnpm 9.15.0 (`corepack enable` if needed)
- Docker Desktop (for PostgreSQL)

### Install

```bash
git clone https://github.com/koomedenis40/yardflow.git
cd yardflow
pnpm install
```

### Environment

Copy and configure:

```bash
cp apps/api/.env.example apps/api/.env
```

Key values:

```
DATABASE_URL=postgresql://yardflow:yardflow@127.0.0.1:5434/yardflow?schema=public
PORT=3001
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=change-me-in-production-min-32-chars-long
JWT_REFRESH_SECRET=change-me-refresh-min-32-chars-long
```

Web reads API from `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/v1`).

### Database

```bash
pnpm db:up                              # Start Postgres (port 5434)
pnpm db:migrate                         # Apply Prisma migrations
pnpm db:seed                            # Base users/tenants/categories
```

### Build

```bash
pnpm -r build                           # Build all packages + api + web
```

### Test

```bash
pnpm --filter @yardflow/api test        # Unit + e2e (47 tests)
pnpm --filter @yardflow/web lint        # ESLint
pnpm --filter @yardflow/web build       # Next.js production build
```

### Demo data (after API is running)

```bash
pnpm --filter @yardflow/api run seed:demo
```

### Run API only

```bash
pnpm db:up
pnpm --filter @yardflow/api dev         # http://localhost:3001/v1
```

### Run Web only

```bash
pnpm --filter @yardflow/web dev         # http://localhost:3000
```

### Run everything

```bash
pnpm db:up
pnpm dev                                # Turbo: api + web concurrently
# or clean web cache first:
pnpm dev:fresh
```

### Stop database

```bash
pnpm db:down
```

---

## 8. Known Issues

### User-reported UI issues (R5.6 follow-up — **not measured / not fixed**)

These were reported during handover prep. They were **not included in the R5.6 manual verification checklist** (`R5_6_UI_PRODUCT_QUALITY_REPORT.md` §4) and have **not been reproduced or measured** in this session (no viewport audit, no scroll-height instrumentation). Treat as open defects for the next session.

| Issue | Pages | Status | Description | Likely cause (unverified) |
|-------|-------|--------|-------------|---------------------------|
| Excessive page scroll | **Dashboard**, **Audit** (and possibly other unconstrained pages) | **Unmeasured** | User reports unwanted vertical scrolling / empty scrollable area below content | App shell uses `min-height: 100vh` without a max-height scroll container; dashboard stacks 5+ sections via `.dashboard-sections` with no viewport cap; audit page renders table + pagination in a bare `<div>` (no `workspace-layout` wrapper) |
| Search "coming soon" | All pages (command header) | Confirmed | Search popover shows backend-not-ready message | `buildSearchApiPath` returns `null`; no `/search` API endpoint exists |
| Login form position | Login | Unmeasured | Form may appear at far left edge on wide screens | `.login-page` uses fixed `480px` left column; form is left-aligned within panel (`max-width: 380px`) |

**Recommended first-step diagnosis (next session):**

1. Open dashboard and audit at 1920×1080 and 1366×768; note whether scroll extends beyond last visible content.
2. Inspect computed heights on `.app-shell`, `.main-column`, `.page-content`, `.dashboard-sections`.
3. Compare with workspace pages (purchases/sales) that use `workspace-layout` — if those scroll correctly, apply the same shell constraints to dashboard/audit.

### Technical debt

| Item | Priority | Detail |
|------|----------|--------|
| e2e tests share dev DB | P2 | `ledger-test-utils.ts` creates `Supplier <hex>` rows in demo DB; run `seed:demo` after tests |
| Server-side pagination | P1 | API returns `take: 100` arrays; web paginates client-side |
| Global search backend | P2 | UI complete; needs scoped search endpoint |
| Suspended tenant guard | P0 | `TenantStatus` enum exists but no enforcement |
| Corrections/adjustments UI | P1 | API only |
| User management API | P1 | No staff invite/disable |
| Party deactivate | P1 | No PATCH routes |
| PostgreSQL RLS | P2 | App-layer isolation only |
| Multiple dev server processes | P2 | Stale `node`/`turbo` processes can stack on Windows; clear ports 3000/3001 before restart |
| CRLF line endings | P3 | Windows may show many files as modified without content changes |

### Deferred features (out of scope R1–R5.6)

- M-Pesa Daraja integration
- Receipt generation + CS30 thermal printing
- Native mobile POS (`apps/pos`)
- Billing / SaaS subscription
- Super Admin platform console
- Reports and exports
- Offline POS queue
- WhatsApp/OCR (Phase 2 PRD)

---

## 9. Next Recommended Milestone — R6 Native Mobile Foundation

### Objectives

1. Restore `apps/pos` Expo/React Native cashier app per `M4_NATIVE_MOBILE_FOUNDATION_REPORT.md`.
2. Extract `packages/theme` from `globals.css` for cross-platform design tokens.
3. Wire buy/sell/pay flows against existing R3/R4 API (no mobile-only business logic).
4. Add `@NotSuspended` tenant guard (P0 blocker).

### Scope

- Expo SDK 56 + Expo Router + TypeScript
- Bottom tab nav: Home, Buy, Sell, Pay, More
- Login with cashier role
- Purchase, sale, supplier payment, buyer collection forms
- Stock read, party lists, categories
- Secure token storage (SecureStore)
- Shared theme package

### Out of scope (R6)

- M-Pesa STK/B2C (defer to R6.5 or R7)
- Receipt printing / CS30 (defer until receipts module exists)
- Billing, Super Admin
- Offline queue production implementation (scaffold only per M4)
- Web UI changes (unless blocking mobile)

### Dependencies

- Stable R3/R4 API ✅ (47 tests passing)
- `CASHIER_PERMISSIONS` defined ✅
- `docs/DESIGN_SYSTEM.md` + `globals.css` tokens ✅
- `packages/theme` ❌ (must create)
- `apps/pos` ❌ (must create from M4 spec)
- Receipt flow ❌ (blocks production POS, not foundation)

### Risks

| Risk | Mitigation |
|------|------------|
| M4 source lost | Use `M4_NATIVE_MOBILE_FOUNDATION_REPORT.md` as rebuild spec |
| Theme drift web↔mobile | Extract `packages/theme` first; single source |
| e2e pollutes demo data | Isolate test DB before mobile QA |
| No receipts | Accept manual confirmation for MVP; add receipts in parallel track |
| Suspended tenant not enforced | Add guard in R6 prep |

---

## 10. Git Status (at handover creation — 2026-06-05)

| Field | Value |
|-------|-------|
| **Branch** | `main` |
| **Tracking** | `origin/main` (up to date) |
| **Latest commit** | `d6b1f9184a2fb15063580b76872f9c39cce7b517` |
| **Latest message** | `rebuild(R5.6): refine operational web quality` |
| **Remote** | https://github.com/koomedenis40/yardflow.git |
| **Working tree** | ~120 modified files + 2 untracked handover docs |
| **Staged changes** | None |
| **`git diff` content** | **Empty** — modifications are phantom (CRLF/LF line-ending normalization on Windows) |

**Authoritative baseline:** commit `d6b1f91` on `origin/main`. Do not treat local "modified" files as intentional edits until `git diff` shows real hunks.

**Untracked (new handover docs):**

- `PROJECT_HANDOVER_R5_6.md`
- `MIGRATION_READINESS_REPORT.md`

**Recommended first action in new session:**

```bash
git fetch origin
git checkout main
git status
git diff                    # expect empty if CRLF-only
# If empty diff: git restore .
```

### Recent commit history (`git log --oneline -10`)

```
d6b1f91 rebuild(R5.6): refine operational web quality
3c554ac rebuild(R5.5): restore design quality and audit recovery
5c2beb7 rebuild(R5): restore operational web ui
4de2428 rebuild(R4): restore payments and balances
44957f5 rebuild(R3): restore core ledger
c98f891 rebuild(R2): restore NestJS API foundation (auth, tenancy, categories)
65c7569 rebuild(R1): scaffold monorepo + shared packages (types, validation, utils)
96d2204 Add recovery plan and bootstrap report
0736674 Restore YardFlow documentation baseline
```

### Validation at handover time

| Check | Result |
|-------|--------|
| `pnpm --filter @yardflow/api test` | ✅ 47/47 passed (4 unit + 43 e2e) |

---

## Key reference documents

| Document | Purpose |
|----------|---------|
| `PRD.md` | Product requirements |
| `docs/DESIGN_SYSTEM.md` | Frozen UI tokens |
| `docs/UI_DIRECTION.md` | Product flows and page list |
| `docs/SYSTEM_RULES.md` | Business rules |
| `docs/DATABASE_CONTRACTS.md` | Schema contracts |
| `docs/TRANSACTION_FLOWS.md` | Ledger/payment flows |
| `docs/PERMISSION_MATRIX.md` | Role permissions |
| `RECOVERY_FUNCTIONALITY_AUDIT.md` | Full gap matrix |
| `R5_6_UI_PRODUCT_QUALITY_REPORT.md` | Latest UI audit |
| `M4_NATIVE_MOBILE_FOUNDATION_REPORT.md` | Mobile rebuild spec |
| `RECOVERY_PLAN_AND_INCIDENT_REPORT.md` | Incident context |

---

*Handover prepared 2026-06-05. No application code modified during this document creation.*
