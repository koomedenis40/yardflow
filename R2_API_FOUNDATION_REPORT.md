# YardFlow — R2 API Foundation Report

**Milestone:** R2 — API Foundation Rebuild  
**Date:** 2026-06-05  
**Workspace:** `C:\dev\yardflow-rebuild`  
**Status:** Complete — build, migrate, seed, and tests green

---

## 1. Files Created

### Shared package extensions (R1 → R2)

| Package | Files added/updated |
|---------|---------------------|
| `@yardflow/types` | `permissions.ts`, `auth.ts`, `tenant.ts`, `index.ts` |
| `@yardflow/utils` | `slugify.ts` |

### API (`apps/api`)

| Area | Files |
|------|-------|
| Config | `package.json`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `.env.example`, `jest.config.js`, `jest-e2e.json` |
| Prisma | `schema.prisma`, `migrations/20250603000000_init_r2/migration.sql`, `seed.ts` |
| Core | `src/main.ts`, `src/app.module.ts`, `src/config/*`, `src/prisma/*` |
| Guards/decorators | `jwt-auth.guard.ts`, `permissions.guard.ts`, `tenant-membership.guard.ts`, `current-user.decorator.ts`, `require-permissions.decorator.ts`, `public.decorator.ts` |
| Modules | `health`, `auth`, `tenants`, `users`, `categories`, `audit` |
| Tests | `test/permissions.unit.spec.ts`, `test/app.e2e-spec.ts` |

---

## 2. Schema Models (R2 scope)

| Model | Purpose |
|-------|---------|
| `Tenant` | Multi-tenant yard; status enum, slug, receipt prefix |
| `User` | Auth identity; optional email; `isPlatformAdmin` |
| `UserTenant` | Membership + role (`owner` \| `cashier`) |
| `RefreshToken` | Hashed rotating refresh tokens (SHA-256) |
| `ScrapCategory` | Tenant-scoped catalog; DECIMAL(14,2) prices |
| `AuditLog` | Append-only audit skeleton |

Enums: `TenantStatus`, `UserTenantRole`

---

## 3. Auth Design

- **Password hashing:** bcrypt (cost 10)
- **Access token:** JWT (`JWT_SECRET`), claims include `sub`, `tenantId`, `tenantSlug`, `role`, `permissions[]`, `isPlatformAdmin`
- **Refresh token:** Random 48-byte hex; stored as SHA-256 hash; rotated on refresh; revoked on logout
- **Platform admin:** Login without `tenantSlug`; JWT omits tenant context
- **Tenant users:** Login requires `tenantSlug`; permissions from role (`OWNER_PERMISSIONS` / `CASHIER_PERMISSIONS`)
- **Validation:** `@yardflow/validation` `loginSchema` on POST `/v1/auth/login`

---

## 4. Tenant Isolation Design

- `tenantId` and `tenantSlug` come **only from JWT** — never from request body for scoped reads
- `TenantMembershipGuard` blocks tenant-scoped routes when JWT lacks `tenantId`
- `CategoriesService` always filters `WHERE tenant_id = jwt.tenantId`
- Cross-tenant category by ID returns **404** (not found in tenant scope)
- `PrismaService.setTenantContext()` prepared for future RLS (`app.current_tenant`)
- Migration SQL includes commented RLS policy template (not enabled in R2)

---

## 5. Permission Implementation

Constants and role sets in `@yardflow/types/permissions.ts`.

| Permission | Owner | Cashier | Platform Admin |
|------------|:-----:|:-------:|:--------------:|
| `category:view` | ✓ | ✓ | — |
| `report:view` | ✓ | — | — |
| `audit:view` | ✓ | — | ✓ |
| `platform:tenant:view` | — | — | ✓ |
| `platform:tenant:create` | — | — | ✓ |

- `@RequirePermissions(...)` decorator + `PermissionsGuard`
- Global `JwtAuthGuard` with `@Public()` opt-out on health/auth login/refresh/logout

---

## 6. Endpoints

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/v1/health` | Public | — |
| POST | `/v1/auth/login` | Public | — |
| POST | `/v1/auth/refresh` | Public | — |
| POST | `/v1/auth/logout` | Public | — |
| GET | `/v1/auth/me` | JWT | — |
| GET | `/v1/categories` | JWT + tenant | `category:view` |
| GET | `/v1/categories/:id` | JWT + tenant | `category:view` |
| GET | `/v1/users/reports-access` | JWT + tenant | `report:view` |
| GET | `/v1/audit/logs` | JWT + tenant | `audit:view` |
| GET | `/v1/tenants` | JWT | `platform:tenant:view` |
| POST | `/v1/tenants` | JWT | `platform:tenant:create` |

---

## 7. Seed Credentials

| User | Email | Password | Tenant slug |
|------|-------|----------|-------------|
| Platform admin | admin@yardflow.local | Password123! | — |
| Owner | owner@demo.local | Password123! | demo-yard |
| Cashier | cashier@demo.local | Password123! | demo-yard |

Also seeded: `other-yard` tenant (isolation tests), 12 default categories per tenant.

---

## 8. Commands Run

```powershell
cd C:\dev\yardflow-rebuild
git status   # clean before start

docker compose -f infra/docker-compose.yml down -v   # fresh R2-only DB
docker compose -f infra/docker-compose.yml up -d

Copy-Item .env.example apps\api\.env -Force
pnpm install
pnpm -r build
cd apps\api
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run seed
pnpm test
pnpm -r build
```

---

## 9. Test Results

```
Unit:  4/4 passed (permissions)
E2E:  13/13 passed
Total: 17/17 passed
```

E2E coverage: health, owner/cashier/platform login, permission claims, category list (12), RBAC 403/200, tenant isolation 404, unauthenticated 401.

---

## 10. Known Limitations (R2)

- No ledger tables (purchases, sales, payments, stock) — R3+
- No M-Pesa, receipts, billing business logic
- RLS not enabled (helper prepared only)
- Refresh token rotation does not preserve original tenant context for multi-tenant users (single-tenant seed OK)
- JWT in Bearer header (no HTTP-only cookies yet)
- No user invite / category CRUD mutations
- Docker volume was reset for clean R2 schema (prior M2/M3 tables removed from local dev DB)

---

## 11. Next Milestone Recommendation — R3 Core Ledger

Rebuild Prisma models and transactional services for:

- `suppliers`, `buyers`, `purchases`, `sales`, `stock_balances`, `stock_movements`
- Append-only ledger per `TRANSACTION_FLOWS.md`
- Serializable isolation + `FOR UPDATE` on stock
- Integration tests for oversell prevention and idempotency

**Gate before R3:** R2 committed and pushed (done as part of this milestone).

---

*R2 restores YardFlow's secure API foundation. Proceed to R3 ledger rebuild.*
