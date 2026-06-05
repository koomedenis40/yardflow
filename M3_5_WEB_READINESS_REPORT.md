# YardFlow — M3.5 Web Operational Readiness Report

**Milestone:** M3.5 Web Operational Readiness & Auth/Layout Fixes  
**Date:** 2026-06-04  
**Status:** Complete — auth stability, 401 handling, desktop layout pass

---

## 1. Summary

M3.5 is a **stability and usability pass** before M4 (POS/mobile). No ledger, payment, or business logic changes.

Fixed:

- Login redirect React warning (`router.replace` during render)
- Uncaught `Unauthorized` runtime errors from expired/missing tokens
- Protected pages fetching before auth is ready
- Large-desktop layout: centered content, better workspace grid use

---

## 2. Root causes

| Issue | Root cause |
|-------|------------|
| Login console error | `router.replace()` called in render when session already existed |
| Unauthorized crashes | `apiFetch` threw generic `Error` with message `"Unauthorized"`; no global 401 handler; multiple parallel fetches spammed errors |
| Repeated 401 noise | Each failed request surfaced error in UI while redirect was not coordinated |
| Early API calls | Workspaces checked `session?.accessToken` but not `isLoading`; race on hydration |
| Desktop empty gutter | `.page-content` had `max-width: 1280px` without `margin-inline: auto` — content stuck to sidebar side on wide screens |

---

## 3. Files changed

### Auth & API

| File | Change |
|------|--------|
| `apps/web/src/lib/api.ts` | `ApiError` with status; `setOnUnauthorized`; debounced 401 handler; `isUnauthorizedError` / `getFetchErrorMessage` helpers |
| `apps/web/src/lib/auth-context.tsx` | Register 401 handler (clear session + redirect); export `isAuthReady`, `accessToken` |
| `apps/web/src/app/login/page.tsx` | Redirect moved to `useEffect`; loading state while redirecting |
| `apps/web/src/components/tenant-shell.tsx` | Loading shell until `accessToken` present |

### Protected fetchers

| File | Change |
|------|--------|
| `apps/web/src/app/[tenantSlug]/dashboard/page.tsx` | Wait for `isAuthReady`; suppress 401 error display |
| `apps/web/src/components/ops/purchases-workspace.tsx` | Same |
| `apps/web/src/components/ops/sales-workspace.tsx` | Same |
| `apps/web/src/components/ops/party-workspace.tsx` | Same |
| `apps/web/src/components/ops/inventory-workspace.tsx` | Same |
| `apps/web/src/components/ops/categories-workspace.tsx` | Same |

### Layout

| File | Change |
|------|--------|
| `apps/web/src/app/globals.css` | Centered `page-content` (max 1400–1440px); wider workspace split on large screens; dashboard section rhythm; loading shell |
| `apps/web/src/app/[tenantSlug]/dashboard/page.tsx` | `dashboard-sections` wrapper |

---

## 4. Auth fixes

### Login redirect

```tsx
useEffect(() => {
  if (!isLoading && session?.user.tenantSlug) {
    setRedirecting(true);
    router.replace(`/${session.user.tenantSlug}/dashboard`);
  }
}, [isLoading, session?.user.tenantSlug, router]);
```

Shows minimal loading UI while redirecting — no render-phase router updates.

### Auth readiness

`AuthProvider` exposes:

- `isAuthReady` — `!isLoading && !!accessToken`
- `accessToken` — null until ready

All workspace/dashboard effects gate on both.

---

## 5. Unauthorized handling strategy

1. **`apiFetch`** throws `ApiError(message, status)` on non-OK responses.
2. On **401**, calls registered `onUnauthorized` once (2s debounce window).
3. **`AuthProvider`** registers handler: `clearSession()` → `setSession(null)` → `router.replace("/login")`.
4. **`getFetchErrorMessage`** returns `null` for 401 — UI does not show "Unauthorized" while redirecting.
5. **`TenantShell`** shows loading until session + token exist; redirects unauthenticated users to `/login`.

Flow:

```
401 response → clear local session → single redirect → protected fetches skipped
```

---

## 6. Layout changes

| Breakpoint | Behavior |
|------------|----------|
| **≥1440px** | Content max-width 1440px, centered, extra horizontal padding |
| **≥1100px** | Workspace split: primary table + wider quick-entry panel (300–400px) |
| **≤900px** | Workspace stacks (secondary below primary) |
| **≤768px** | Mobile nav tab bar (unchanged) |

Other tweaks:

- KPI grid: `minmax(200px, 1fr)` → `220px` on wide screens
- Dashboard sections wrapped in `.dashboard-sections` for consistent vertical rhythm
- `margin-inline: auto` on `.page-content` eliminates left-heavy empty gutter

Design system tokens and IBM-style restraint preserved.

---

## 7. Commands run

```bash
pnpm --filter @yardflow/web lint          # ✓ pass
pnpm --filter @yardflow/web build         # ✓ pass
pnpm --filter @yardflow/api test          # ✓ 38/38 pass
pnpm build                                # ✗ API Prisma EPERM (dev server lock)
```

**Note:** `pnpm build` failed because `pnpm dev:fresh` holds the Prisma query engine on Windows. Stop dev servers on 3000/3001, then rerun `pnpm build`. Individual package builds pass.

---

## 8. Test / build results

| Check | Result |
|-------|--------|
| Web lint (`tsc --noEmit`) | Pass |
| Web build | Pass |
| API tests | 38/38 pass (ledger + payments unchanged) |
| Full `pnpm build` | Blocked by dev-server Prisma lock (environmental) |

---

## 9. Remaining risks

| Risk | Notes |
|------|-------|
| No token refresh | Expired access token triggers logout redirect; refresh endpoint exists but not wired in web yet |
| Dev `.next` cache | Running `next build` while dev server is up can corrupt dev cache — use `pnpm dev:fresh` after |
| `pnpm build` on Windows with dev up | Prisma EPERM — stop dev first |
| Standalone payments route | Still deferred from M3 (low priority) |

---

## 10. Recommendation before M4

M3.5 closes the web stability gaps needed before POS/mobile:

1. **Proceed to M4** on current web foundation.
2. **Optional fast follow:** wire `/auth/refresh` for silent token renewal (reduces login redirects during long sessions).
3. **Dev hygiene:** stop `pnpm dev:fresh` before monorepo `pnpm build` in CI/local release checks.

---

## 11. Success criteria

| Criterion | Status |
|-----------|--------|
| Login redirect console error gone | ✅ |
| Unauthorized runtime crash gone | ✅ |
| Stale sessions redirect to login | ✅ |
| Protected pages wait for auth | ✅ |
| Desktop layout uses space better | ✅ |
| Wide-screen gutter reduced | ✅ |
| Web lint/build pass | ✅ |
| API tests pass (no regression) | ✅ 38/38 |
| No ledger/payment behavior change | ✅ |

**M3.5 is complete.**
