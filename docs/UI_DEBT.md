# YardFlow — UI Debt Log

**Last updated:** 2026-06-06  
**Scope:** Owner web dashboard (`apps/web`) post-R5.6  
**Canonical reference:** [WEB_UI_IMPROVEMENTS_SUMMARY.md](../WEB_UI_IMPROVEMENTS_SUMMARY.md) §4

Priorities: **P0** = must fix immediately · **P1** = should fix before mobile · **P2** = can defer · **P3** = future polish

---

| Priority | Area | Issue | Recommended Fix | Before Mobile? |
|----------|------|-------|-----------------|----------------|
| P0 | Auth / Platform | No suspended-tenant guard — `TenantStatus` enum exists but no `@NotSuspended` guard enforces it | Add `TenantMembershipGuard` check for `TenantStatus.SUSPENDED`; return 403 with clear message | **Yes** |
| P1 | Dashboard scroll | Unwanted vertical scroll below last content reported at 1920×1080 and 1366×768 (unmeasured; not reproduced in R5.5/R5.6) | Measure computed heights on `.app-shell`, `.main-column`, `.page-content`, `.dashboard-sections`; constrain with `overflow-y: auto` scroll container; compare with workspace pages that use `workspace-layout` | **Yes** |
| P1 | Audit scroll | Audit page renders table in bare `<div>` without `workspace-layout` wrapper — likely shares same scroll issue as dashboard | Wrap audit page content in `workspace-layout` or equivalent viewport-constrained container | **Yes** |
| P1 | Server-side pagination | API returns `take: 100` flat arrays; web paginates client-side — breaks at scale, violates M2.5 list-query contract | Implement cursor/offset pagination on list endpoints (`purchases`, `sales`, `suppliers`, `buyers`, `inventory`, `audit`); update web to pass `page`/`limit` query params | **Yes** |
| P1 | Corrections UI | API endpoints exist (`corrections.controller.ts`) but no web workflow for owner corrections | Add correction form to purchase/sale drawers with impact preview; wire to existing API | **Yes** |
| P1 | Stock adjustment UI | `POST /inventory/adjustments` API exists but no web form | Add adjustment modal to inventory workspace; show signed delta + reason field | **Yes** |
| P1 | User management API | No invite/disable/role-change endpoints — staff management not recoverable from web | Add `POST /users/invite`, `PATCH /users/:id/role`, `DELETE /users/:id/disable` | **Yes** |
| P1 | Party deactivate | Suppliers and buyers cannot be deactivated from the web — no `PATCH /suppliers/:id` or `PATCH /buyers/:id` routes | Add PATCH routes with `isActive` toggle; show deactivated parties with muted row style and hide from active lists | **No** |
| P2 | Search backend | Search popover is UX-complete; `buildSearchApiPath()` returns `null`; no `/search` endpoint exists | Implement scoped search API (suppliers, buyers, purchases, sales, categories by name/ref); wire into `global-search.tsx` | **No** |
| P2 | Login form alignment | Fixed 480px left column with `max-width: 380px` form may appear left-aligned on very wide screens (unmeasured) | Center form within panel using flexbox; or widen left column proportionally above 1600px | **No** |
| P2 | e2e test database pollution | `ledger-test-utils.ts` creates `Supplier <hex>` rows in shared dev database; `pnpm test` leaves test artifacts in demo UI | Create dedicated test database; point e2e config at it; remove shared dev DB dependency | **No** |
| P2 | Category inline edit | Categories can be created and deactivated but not edited; no `PATCH /categories/:id` route | Add inline edit form to `categories-workspace.tsx`; add PATCH route | **No** |
| P2 | Settings page | Settings page is a static tenant-context display; no API wiring for settings mutations | Define settings schema; add relevant settings endpoints and form | **No** |
| P2 | Balances client lists | Balance tables pre-filter to non-zero rows (acceptable now); no server-side filtering | Acceptable at current data volume; revisit when party count exceeds 200 | **No** |
| P2 | packages/theme missing | Design tokens exist only in `globals.css`; no shared `packages/theme` for mobile parity | Extract CSS custom properties from `globals.css` into `packages/theme` as TypeScript/JSON tokens before first R6 commit | **Yes** |
| P2 | PostgreSQL RLS | Tenant isolation is app-layer only (`tenantId` in every query); no DB-level row-level security | Enable RLS on all tenant-scoped tables as defense-in-depth; blocked by Prisma native support | **No** |
| P3 | Mobile web nav | Sidebar hidden below 1100px; no mobile navigation drawer on web | Acceptable — native mobile handles this; add mobile drawer only if web-on-phone becomes a supported use case | **No** |
| P3 | Refresh token multi-tenant | Refresh token service picks first tenant membership; multi-tenant users get wrong tenant on refresh | Fix `auth.service.ts` to use tenant from original JWT payload on refresh | **No** |
| P3 | Chart coverage | Dashboard has weekly trend bars only; no profit trend, category breakdown, or intake/sales comparison charts | Add charts module when report API endpoints exist | **No** |
| P3 | Reports / exports | No profit report, intake report, or CSV export | Defer to post-mobile feature track | **No** |
| P3 | Super Admin UI | No `/admin` routes for platform tenant management, billing, health | Defer to post-mobile platform track | **No** |
| P3 | Windows CRLF noise | `git status` reports ~120 phantom modified files due to CRLF/LF normalization on Windows | Configure `.gitattributes` `* text=auto` and re-checkout; `git diff` is empty so no content risk | **No** |

---

## Items That Are NOT Debt

These were explicitly deferred and are not web UI debt — they are future milestones:

- M-Pesa Daraja integration (R7)
- Receipt generation + CS30 thermal print (R7)
- Native mobile POS `apps/pos` (R6 — this is the next milestone)
- Billing / SaaS subscriptions (post-R7)
- Super Admin console (post-R7)
- Offline POS queue (post-R6 mobile foundation)
- WhatsApp / OCR (Phase 2 PRD)

---

## Debt Summary by Count

| Priority | Count | Before Mobile? |
|----------|-------|----------------|
| P0 | 1 | 1 |
| P1 | 7 | 5 |
| P2 | 8 | 1 (`packages/theme`) |
| P3 | 6 | 0 |
| **Total** | **22** | **7** |
