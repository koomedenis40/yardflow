# M3.6 Internal Server Error — Structured Diagnosis

**Date:** 2026-06-05  
**Scope:** Post–M3.6 Adaptive Dashboard Composition  
**Method:** Structured checks (no speculative code fixes)

---

## Executive summary

The reported **Internal Server Error** was **not** caused by M3.6 application logic or missing API endpoints. It was caused by a **corrupted Next.js dev cache** (`apps/web/.next`) on Windows, triggered when a production `next build` ran while `pnpm dev:fresh` was still active.

The browser showed 500 on **Next.js page routes** (e.g. `/login`, `/demo-yard/dashboard`). No NestJS `/v1/*` endpoint returned 500 during the failure window.

**Fix applied:** Stop dev processes → clean `.next` → restart `pnpm dev:fresh`. **No M3.6 source files were changed.**

---

## 1. Is PostgreSQL running?

| Check | Result |
|-------|--------|
| Container | `yardflow-postgres` |
| Status | **Up (healthy)** — port `5434` |
| Command | `docker ps --filter "name=yardflow-postgres"` |

**Verdict:** ✅ PostgreSQL is running and healthy.

---

## 2. Is NestJS API running?

| Phase | Result |
|-------|--------|
| During initial failure | ❌ Intermittently down — `EADDRINUSE :::3001` from competing watch restarts |
| After fix (2026-06-05 06:45) | ✅ `YardFlow API listening on http://localhost:3001/v1` |

**Verdict:** API was unstable during diagnosis due to port conflicts; stable after clean restart.

---

## 3. Does `GET /v1/health` succeed?

| Phase | Result |
|-------|--------|
| During failure | ❌ Connection refused (API not listening) |
| After fix | ✅ **200** `{"status":"ok","service":"yardflow-api",...}` |

**Command:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/v1/health" -UseBasicParsing
```

**Verdict:** ✅ Health endpoint OK after restart.

---

## 4. Are Prisma migrations current?

```
3 migrations found in prisma/migrations
Database schema is up to date!
```

**Command:**
```powershell
cd apps/api
npx prisma migrate status
```

**Verdict:** ✅ Migrations current. Not a factor in the 500 errors.

---

## 5. Browser network requests — which endpoint returns 500?

The 500s were **Next.js document/page requests**, not API calls.

### Failing requests (from Next.js dev terminal `939619.txt`, `578589.txt`)

| Request | Status | Layer |
|---------|--------|-------|
| `GET /login` | **500** | Next.js SSR |
| `GET /demo-yard/dashboard` | **500** | Next.js SSR |
| `GET /demo-yard/suppliers` | **500** | Next.js SSR |
| `GET /demo-yard/inventory` | **500** | Next.js SSR |
| `GET /demo-yard/buyers` | **500** | Next.js SSR |
| `GET /demo-yard/sales` | **500** | Next.js SSR |
| `GET /` | **500** | Next.js SSR |

### Not failing

- No `GET /v1/*` 500 observed in API logs during the failure window.
- Client-side API calls (`/v1/dashboard/overview`, etc.) run **after** page shell loads; they cannot cause SSR 500 on initial navigation.

**Primary failing endpoint (first observed):** `GET /login`  
**User-visible symptom:** Next.js runtime error overlay: `Cannot find module './891.js'`

---

## 6. API logs — stack traces

API logs showed **port binding conflicts**, not application exceptions:

```
[NestApplication] Error: listen EADDRINUSE: address already in use :::3001
  code: 'EADDRINUSE',
  errno: -4091,
  syscall: 'listen',
  address: '::',
  port: 3001
```

**Verdict:** Secondary issue (dev environment). Not the root cause of page 500s. API was healthy when bound and serving requests before cache corruption spread.

---

## 7. Next.js terminal logs — stack traces (root cause)

### Error A — missing webpack chunk (`/login`)

```
⨯ Error: Cannot find module './891.js'
Require stack:
- .../apps/web/.next/server/webpack-runtime.js
- .../apps/web/.next/server/app/login/page.js
- .../next/dist/server/require.js
- .../next/dist/server/load-components.js
  code: 'MODULE_NOT_FOUND',
  page: '/login'

GET /login 500 in 22917ms
```

### Error B — missing vendor chunk (tenant pages)

```
⨯ [Error: Cannot find module './vendor-chunks/next@15.5.19_react-dom@19.2.7_react@19.2.7__react@19.2.7.js'
Require stack:
- .../apps/web/.next/server/webpack-runtime.js
- .../apps/web/.next/server/app/[tenantSlug]/suppliers/page.js
  code: 'MODULE_NOT_FOUND',
  page: '/demo-yard/suppliers'

GET /demo-yard/suppliers 500 in 22972ms
GET /demo-yard/inventory 500 in 22977ms
GET /demo-yard/buyers 500 in 22977ms
GET /demo-yard/sales 500 in 22981ms
```

### Error C — incomplete build artifacts (`711829.txt`)

```
⨯ [Error: ENOENT: no such file or directory, open
  '...\apps\web\.next\prerender-manifest.json']
```

**Interpretation:** `.next` contained stale `page.js` bundles referencing chunk IDs (`891.js`, vendor-chunks) that were deleted or overwritten — classic corruption when `next build` and `next dev` contend for the same `.next` directory on Windows.

---

## 8. M3.6 dashboard / search / topbar — missing data audit

| Component | API calls? | Notes |
|-----------|------------|-------|
| `operational-topbar.tsx` | **None** | Layout + page meta only |
| `global-search.tsx` | **None** | UI-only search shell |
| `page-meta.ts` | **None** | Static title/subtitle map |
| `search-types.ts` | **None** | Type definitions only |
| `kpi-group.tsx` | **None** | Presentational wrapper |
| `dashboard/page.tsx` | `GET /v1/dashboard/overview` | **Unchanged from M3** — endpoint exists, returns 200 when authenticated |

**Verdict:** ✅ M3.6 did **not** introduce requests to non-existent API endpoints. The failure occurred at Next.js page render time, before any client fetch runs.

---

## Root cause

| Item | Detail |
|------|--------|
| **Category** | Dev environment / build artifact corruption |
| **Root cause** | Corrupted `apps/web/.next` dev cache — webpack runtime references missing chunk files after concurrent `next build` + `next dev` |
| **Trigger** | Running `pnpm --filter @yardflow/web build` (or `pnpm build`) while `pnpm dev:fresh` was active during M3.6 verification |
| **Not root cause** | M3.6 UI code, Prisma schema, missing API routes, PostgreSQL |

---

## Affected files

| Path | Role |
|------|------|
| `apps/web/.next/` | **Corrupted cache directory** (not source code) |
| `apps/web/.next/server/webpack-runtime.js` | Referenced missing `./891.js` |
| `apps/web/.next/server/app/login/page.js` | First page to surface `MODULE_NOT_FOUND` |
| `apps/web/.next/server/app/[tenantSlug]/*/page.js` | Referenced missing vendor-chunks |

**No M3.6 source files require code changes for this incident.**

---

## Fix applied

Environmental recovery (no application code diff):

1. Stopped processes listening on ports **3000** and **3001**
2. Ran `node apps/web/scripts/clean-next.mjs` (removes `.next`)
3. Restarted `pnpm dev:fresh` from repo root

```powershell
# Stop dev servers on 3000 / 3001
foreach ($port in 3000,3001) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

# Clean Next.js cache
cd apps/web
node scripts/clean-next.mjs

# Restart dev stack (also runs clean via package script)
cd ../..
pnpm dev:fresh
```

---

## Verification steps (post-fix)

| Check | Expected | Actual (2026-06-05 06:46) |
|-------|----------|---------------------------|
| `GET /v1/health` | 200 | ✅ 200 |
| `GET http://localhost:3000/login` | 200 | ✅ 200 |
| `GET http://localhost:3000/demo-yard/dashboard` | 200 | ✅ 200 |
| `GET http://localhost:3000/demo-yard/suppliers` | 200 | ✅ 200 |
| `GET http://localhost:3000/demo-yard/inventory` | 200 | ✅ 200 |
| `POST /v1/auth/login` | 200 + token | ✅ OK |
| `GET /v1/dashboard/overview` (Bearer) | 200 | ✅ 200 |
| `npx prisma migrate status` | up to date | ✅ 3 migrations applied |
| Next.js terminal | No `MODULE_NOT_FOUND` | ✅ Clean compile logs |

**Manual browser check:** Hard refresh (Ctrl+Shift+R) on `/login` and `/demo-yard/dashboard` — runtime overlay should be gone.

---

## Commands run (full list)

```powershell
# Infrastructure
docker ps --filter "name=yardflow-postgres" --format "{{.Names}} {{.Status}}"

# Migrations
cd apps/api
npx prisma migrate status

# Port cleanup + cache clean + restart
foreach ($port in 3000,3001) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2
cd apps/web
node scripts/clean-next.mjs
cd ../..
pnpm dev:fresh

# Post-fix HTTP checks
Invoke-WebRequest -Uri "http://localhost:3001/v1/health" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:3000/demo-yard/dashboard" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:3000/demo-yard/suppliers" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:3000/demo-yard/inventory" -UseBasicParsing

# API data path (dashboard unchanged from M3)
$body = '{"email":"owner@demo.local","password":"Password123!","tenantSlug":"demo-yard"}'
$login = Invoke-RestMethod -Uri "http://localhost:3001/v1/auth/login" -Method POST -Body $body -ContentType "application/json"
Invoke-WebRequest -Uri "http://localhost:3001/v1/dashboard/overview" -Headers @{Authorization="Bearer $($login.accessToken)"} -UseBasicParsing
```

---

## Prevention (dev hygiene)

1. **Never** run `pnpm build` or `pnpm --filter @yardflow/web build` while `pnpm dev:fresh` is running on Windows.
2. If `Cannot find module './NNN.js'` appears again: stop dev → `pnpm dev:fresh` (auto-cleans `.next`).
3. Wait for `YardFlow API listening on http://localhost:3001/v1` before logging in after a cold start.
4. If `EADDRINUSE :::3001` recurs, kill port 3001 and restart once — avoid stacking multiple `pnpm dev` sessions.

---

## Conclusion

| Question | Answer |
|----------|--------|
| Failing endpoint | Next.js page routes (`/login`, `/demo-yard/*`) — **not** `/v1/*` |
| Root cause | Corrupted `.next` dev cache from build+dev concurrency |
| M3.6 code at fault? | **No** |
| Code fix required? | **No** — environmental clean + restart |
| Status after fix | ✅ All checked routes and API endpoints return 200 |
