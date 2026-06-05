# YardFlow — M1 Database Connection Fix Report

**Date:** 2026-06-03  
**Issue:** Prisma `P1010` / `P1000` while `docker exec psql` succeeded  
**Status:** Resolved — M1 database gates closed

---

## 1. Root Cause

**Prisma was not failing because of env parsing, quotes, or workspace bugs.**

Host tools (Prisma CLI, NestJS, `psql` on Windows) connected to **`127.0.0.1:5432`**, which reached **locally installed PostgreSQL** (services `postgresql-x64-16` and `postgresql-x64-18`), **not** the Docker container.

| Connection path | Target | Result |
|-----------------|--------|--------|
| `docker exec … psql -U yardflow` | Postgres **inside** container | Works — user `yardflow` exists |
| `psql -h 127.0.0.1 -p 5432 -U yardflow` (host) | **Windows** Postgres on 5432 | `FATAL: role "yardflow" does not exist` |
| `pnpm exec prisma migrate deploy` (before fix) | **Windows** Postgres on 5432 | `P1010: User was denied access` |

Prisma’s `(not available)` database name is a generic message when auth/role checks fail against the wrong server.

### Secondary factors (not root cause)

| Factor | Impact |
|--------|--------|
| Quoted `DATABASE_URL` in `.env` | Prisma still parsed host correctly once port was fixed |
| `localhost` vs `127.0.0.1` | Both hit host Postgres on 5432 |
| PowerShell `$env:DATABASE_URL=…` | Overrides `.env`; user had set `localhost:5432`, masking `.env` edits |
| Split `.env` (root vs `apps/api/`) | Prisma run from `apps/api` loads `apps/api/.env` — OK after sync |
| Port `5433` trial | **Also** occupied by local Postgres on this machine — auth failed on wrong instance |

---

## 2. Investigation Evidence

Commands run during diagnosis:

```powershell
# Local PostgreSQL services running
Get-Service *postgres*
# postgresql-x64-16 Running
# postgresql-x64-18 Running

# Host connection to default port → wrong server
psql -h 127.0.0.1 -p 5432 -U yardflow -d yardflow
# FATAL: role "yardflow" does not exist

# Port 5433 listeners (after first fix attempt)
# OwningProcess: com.docker.backend AND postgres (two processes!)

# Port 5434 — only Docker
psql -h 127.0.0.1 -p 5434 -U yardflow -d yardflow
# PostgreSQL 16.14 on x86_64-pc-linux-musl (Alpine) → Docker image
```

---

## 3. Fix Applied

**Map Docker Postgres to host port `5434`** and align all `DATABASE_URL` values to `127.0.0.1:5434`.

No Prisma bypass, no weakened security, no hardcoded credentials in code.

### Files changed

| File | Change |
|------|--------|
| `infra/docker-compose.yml` | `ports: "5434:5432"` + comment |
| `infra/README.md` | **New** — explains port conflict |
| `.env.example` | `DATABASE_URL` → port **5434**, unquoted |
| `.env` | Same |
| `apps/api/.env` | Same |
| `apps/api/.env.example` | Same |
| `README.md` | Quick start notes port **5434** |

### Unchanged (intentionally)

| Item | Reason |
|------|--------|
| `prisma/schema.prisma` | `env("DATABASE_URL")` was correct |
| `.github/workflows/ci.yml` | CI Postgres on 5432 has no local conflict |
| Application code | No code changes required |

---

## 4. Why the Failure Happened

1. Docker published container `5432` → host `5432`.
2. Windows already bound `5432` (and `5433`) to native PostgreSQL.
3. Incoming TCP to `127.0.0.1:5432` was handled by **native** Postgres first (or exclusively).
4. Native instance has no `yardflow` role → Prisma reported access denied.
5. `docker exec` never used the host port map, so it appeared “Docker works but Prisma doesn’t.”

---

## 5. Commands Executed (Verification)

```powershell
cd "c:\Users\User\Desktop\Clients\My Projects\yardflow"
docker compose -f infra/docker-compose.yml up -d --force-recreate

# Host reaches Docker Postgres
$env:PGPASSWORD='yardflow'
psql -h 127.0.0.1 -p 5434 -U yardflow -d yardflow -c "SELECT current_database();"
# → yardflow, Alpine PostgreSQL 16.14

cd apps\api
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
pnpm exec prisma migrate deploy   # ✓ Applied 20250603000000_init_m1
pnpm exec prisma generate         # ✓
pnpm run seed                     # ✓ demo users + 12 categories
pnpm test                         # ✓ 15 passed (11 e2e + 4 unit)
```

### Prisma output (success)

```txt
Datasource "db": PostgreSQL database "yardflow", schema "public" at "127.0.0.1:5434"
All migrations have been successfully applied.
```

### Test results

```txt
Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
```

Includes: health, login (owner/cashier), categories (12 seeded), RBAC 403/200, tenant isolation 404, unauthenticated 401.

---

## 6. Developer Checklist (After Pull)

1. `docker compose -f infra/docker-compose.yml up -d --force-recreate`
2. Ensure `apps/api/.env` and root `.env` use port **5434** (copy from `.env.example`)
3. Clear stale shell override: `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue`
4. `pnpm --filter @yardflow/api exec prisma migrate deploy`
5. `pnpm db:seed`
6. `pnpm test`

---

## 7. Remaining Risks

| Risk | Mitigation |
|------|------------|
| Port **5434** in use on another machine | Change host port in `docker-compose.yml` + `DATABASE_URL` together (`infra/README.md`) |
| Forgotten `$env:DATABASE_URL` in PowerShell | Remove before Prisma/test; document in checklist |
| Root vs `apps/api/.env` drift | Keep both in sync; Prisma uses `apps/api/.env` when run from API package |
| Two local Postgres versions (16 + 18) | Unrelated to YardFlow; avoid binding YardFlow to 5432/5433 |
| Production deploy | Use real connection string; port 5434 is **local dev only** |

---

## 8. M1 Acceptance Gates

| Gate | Status |
|------|--------|
| `prisma migrate deploy` | ✅ |
| `prisma generate` | ✅ |
| `pnpm db:seed` | ✅ |
| Full test suite | ✅ 15/15 |
| Docker-based local dev | ✅ preserved |

**Safe to proceed to M2 Core Ledger.**
