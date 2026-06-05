# YardFlow — M1 Foundation Report

**Milestone:** M1 Foundation  
**Date:** 2026-06-03  
**Status:** Scaffold complete — requires Docker PostgreSQL for full e2e verification locally

---

## 1. Files Created

### Monorepo root

| File | Purpose |
|------|---------|
| `package.json` | pnpm workspace scripts |
| `pnpm-workspace.yaml` | Workspace definition |
| `turbo.json` | Turborepo pipeline |
| `.gitignore` | Ignore node_modules, env, build artifacts |
| `.env.example` | Environment template |
| `README.md` | Quick start guide |
| `.github/workflows/ci.yml` | CI: build + migrate + test with Postgres service |
| `M1_FOUNDATION_REPORT.md` | This report |

### Infrastructure

| File | Purpose |
|------|---------|
| `infra/docker-compose.yml` | PostgreSQL 16 for local dev |

### Packages

| Package | Key files |
|---------|-----------|
| `@yardflow/types` | `permissions.ts`, `tenant.ts`, `auth.ts` |
| `@yardflow/validation` | `auth.schema.ts` (Zod login/refresh) |
| `@yardflow/utils` | `slugify()` |

### API (`apps/api`)

| Area | Files |
|------|-------|
| Prisma | `schema.prisma`, `migrations/20250603000000_init_m1/`, `seed.ts` |
| Config | `env.schema.ts`, `configuration.ts` |
| Core | `prisma.service.ts`, guards, decorators, `app.module.ts`, `main.ts` |
| Modules | `health`, `auth`, `tenants`, `users`, `categories`, `audit` |
| Tests | `test/app.e2e-spec.ts`, `test/permissions.unit.spec.ts` |

### Web (`apps/web`)

| Area | Files |
|------|-------|
| App Router | `login`, `[tenantSlug]/dashboard`, `[tenantSlug]/categories` |
| Lib | `api.ts`, `auth-context.tsx` |
| UI | `tenant-shell.tsx`, `globals.css` |

---

## 2. Commands Run

| Command | Result |
|---------|--------|
| `pnpm install` | Success (lockfile: `pnpm-lock.yaml` generated) |
| `pnpm build` | Success — all 5 packages built |
| `docker compose -f infra/docker-compose.yml up -d` | Requires Docker Desktop; use host port **5434** (see `M1_DB_FIX_REPORT.md`) |
| `pnpm exec prisma generate` | Success |
| `pnpm test` (full) | **Failed** — e2e requires PostgreSQL connection |
| `pnpm test:unit` (api) | **Success** — 4/4 permission unit tests passed |

### Commands to run locally (full acceptance)

```powershell
cd "c:\Users\User\Desktop\Clients\My Projects\yardflow"
pnpm db:up
Copy-Item .env.example .env -Force
Copy-Item .env.example apps\api\.env -Force
pnpm --filter @yardflow/api exec prisma migrate deploy
pnpm db:seed
pnpm test
pnpm dev
```

---

## 3. Test Results

### Unit tests (no database)

```
PASS test/permissions.unit.spec.ts
  √ owner has report:view and audit:view
  √ cashier lacks owner-only permissions
  √ hasPermission enforces all required
  √ platform admin has tenant create
```

### E2E tests (`test/app.e2e-spec.ts`)

| Test | Expected when DB up |
|------|---------------------|
| GET /v1/health | 200 ok |
| Owner login | JWT + owner permissions |
| Cashier login | JWT without report:view |
| Owner lists 12 categories | 200 array length 12 |
| Cashier lists categories | 200 |
| Cashier blocked from /users/reports-access | 403 |
| Owner allowed reports-access | 200 |
| Cashier blocked from /audit/logs | 403 |
| Owner allowed audit/logs | 200 |
| Cross-tenant category by id | 404 |
| Unauthenticated categories | 401 |

**Local run:** Blocked — `PrismaClientInitializationError` (PostgreSQL not available).  
**CI:** Configured with Postgres service; e2e should pass on GitHub Actions.

---

## 4. What Works

- **Monorepo** installs and builds with Turborepo + pnpm  
- **Shared packages** — permissions, validation, utils compile and link  
- **Prisma schema (M1 only)** — `tenants`, `users`, `user_tenants`, `scrap_categories`, `refresh_tokens`, `audit_logs`  
- **API** — NestJS with global prefix `/v1`, config validation, health endpoint  
- **Auth** — JWT login, refresh token storage (hashed), bcrypt passwords, permissions in JWT  
- **Guards** — `JwtAuthGuard`, `PermissionsGuard`, `TenantMembershipGuard`  
- **Tenant isolation** — `tenantId` from JWT only; categories/audit queries filter by JWT tenant  
- **RBAC** — Permission strings from `docs/PERMISSION_MATRIX.md` via `@yardflow/types`  
- **Seed** — Platform admin, demo tenant, owner, cashier, 12 categories, `other-yard` for isolation tests  
- **Web** — Login, tenant-scoped routes (`/demo-yard/dashboard`, `/demo-yard/categories`), API-backed category list  
- **RLS-ready** — `PrismaService.setTenantContext()` + commented RLS policy in migration SQL  

### Seed credentials

| User | Email | Password | Tenant slug |
|------|-------|----------|-------------|
| Platform admin | admin@yardflow.local | Password123! | — |
| Owner | owner@demo.local | Password123! | demo-yard |
| Cashier | cashier@demo.local | Password123! | demo-yard |

---

## 5. Intentionally Not Implemented (M1 scope)

- Purchases, sales, stock movements, payments  
- M-Pesa, receipts, billing, reports (business logic)  
- POS app (`apps/pos`)  
- Ledger tables (`purchases`, `sales`, etc.)  
- PostgreSQL RLS enabled (prepared, not activated)  
- User invite flows, category CRUD mutations  
- HTTP-only cookie auth (MVP uses Bearer token in localStorage for web)  
- Platform admin web UI (API routes only)  
- Email/password reset  

---

## 6. Architecture Decisions (M1)

1. **Tenant ID from JWT only** — never accepted from request body for data queries  
2. **`@CurrentUser()` decorator** — avoids request-scoped injection into singleton services  
3. **`category:view`** added for cashier (operational need; documented in types package)  
4. **Owner-only probes** — `/users/reports-access`, `/audit/logs` for permission testing  
5. **Refresh tokens** — stored as SHA-256 hash in `refresh_tokens` table  
6. **Idempotency / ledger** — schema hooks reserved for M2 (`yard_id` nullable on categories)  

---

## 7. Risks & Blockers

| Item | Severity | Mitigation |
|------|----------|------------|
| Docker not running locally | Medium | Start Docker Desktop; run `pnpm db:up` |
| E2E tests need live Postgres | Medium | CI has service container; local migrate + seed |
| Web stores JWT in localStorage | Low | Move to HTTP-only cookies before production |
| Platform admin login without tenant | Low | Use tenant routes only for tenant users in M1 web |
| `TenantContextService` files unused | Low | Kept for RLS/session work in M2; can wire or remove |

---

## 8. API Endpoints (M1)

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/v1/health` | Public | — |
| POST | `/v1/auth/login` | Public | — |
| POST | `/v1/auth/refresh` | Public | — |
| GET | `/v1/auth/me` | JWT | — |
| GET | `/v1/categories` | JWT + tenant | `category:view` |
| GET | `/v1/categories/:id` | JWT + tenant | `category:view` |
| GET | `/v1/users/reports-access` | JWT + tenant | `report:view` |
| GET | `/v1/audit/logs` | JWT + tenant | `audit:view` |
| GET | `/v1/tenants` | JWT | `platform:tenant:view` |
| POST | `/v1/tenants` | JWT | `platform:tenant:create` |

---

## 9. Next Recommended Milestone — M2 Core Ledger

**Objectives:**

- Add Prisma models: `suppliers`, `buyers`, `purchases`, `sales`, `stock_balances`, `stock_movements`, `corrections`, `stock_adjustments`  
- Implement transactional purchase/sale services per `docs/TRANSACTION_FLOWS.md`  
- Serializable isolation + `FOR UPDATE` on stock  
- Integration tests for oversell prevention and idempotency  

**Dependencies:** M1 acceptance (DB up, e2e green, tenant guards verified)

**Do not start M2 until:**

- [ ] `pnpm db:up` + `prisma migrate deploy` + `pnpm db:seed` succeed  
- [ ] `pnpm test` — all 11 e2e + 4 unit tests pass  
- [ ] Owner and cashier login verified on web  

---

## 10. Acceptance Criteria Checklist

| Criterion | Status |
|-----------|--------|
| Monorepo installs | ✅ |
| API builds | ✅ |
| Web builds | ✅ |
| Database migrates | ⏳ Requires Docker Postgres |
| Seed creates demo data | ⏳ Requires DB |
| Owner/cashier login | ⏳ Requires DB + `pnpm dev` |
| Owner views categories | ⏳ Requires DB + web |
| Cashier blocked owner endpoints | ✅ Unit; ⏳ E2E with DB |
| Tenant isolation test | ⏳ E2E with DB |
| All tests pass | ⚠️ Unit ✅ / E2E ⏳ DB |
| M1 report created | ✅ |

---

*M1 foundation scaffold is ready for database-backed verification and M2 ledger implementation.*
