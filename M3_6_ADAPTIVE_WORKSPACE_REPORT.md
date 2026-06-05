# YardFlow — M3.6 Adaptive Dashboard Composition & Workspace Refinement Report

**Milestone:** M3.6 Adaptive Dashboard Composition & Workspace Refinement  
**Date:** 2026-06-04  
**Status:** Complete — command header, dashboard recomposition, search foundation, responsive layouts

---

## 1. Summary

M3.6 is the **final web UX milestone before M4 (POS Foundation)**. No ledger, payment, or business logic changes.

Delivered:

- **Operational command header** — title, tenant context, global search, quick actions, user menu
- **Dashboard command center** — grouped Operations / Financial KPIs, intel grid, balanced bottom row
- **Fully clickable KPI cards** — no tiny “View →” links; hover affordance on entire card
- **Global search foundation** — scoped UI prepared for future API
- **Workspace refinement** — titles in header; descriptions only in workspace chrome; wider split layouts
- **Responsive adaptation** — 1366px, 1440px, 1920px, ultrawide breakpoints

Design principles extracted from references (hierarchy, spacing, grouping, density) without copying Foodtrack/Fixoria visuals. IBM-style restraint and frozen palette preserved.

---

## 2. Files changed

### New

| File | Purpose |
|------|---------|
| `apps/web/src/components/ops/operational-topbar.tsx` | Command header |
| `apps/web/src/components/ops/global-search.tsx` | Search UI + scope tabs |
| `apps/web/src/components/ops/kpi-group.tsx` | KPI section labels |
| `apps/web/src/lib/page-meta.ts` | Per-route title/subtitle |
| `apps/web/src/lib/search-types.ts` | Search scopes + API path stub |

### Updated

| File | Change |
|------|--------|
| `apps/web/src/components/tenant-shell.tsx` | Uses `OperationalTopbar`; removed duplicate sidebar sign-out prominence |
| `apps/web/src/app/[tenantSlug]/dashboard/page.tsx` | Full dashboard recomposition |
| `apps/web/src/components/ops/kpi-link-card.tsx` | Tones, removed “View →”, full-card link |
| `apps/web/src/components/ui/page-header.tsx` | `leadOnly` mode for workspaces |
| `apps/web/src/components/ops/*-workspace.tsx` | `leadOnly` headers (5 workspaces) |
| `apps/web/src/app/globals.css` | Command header, search, dashboard grids, KPI tones, responsive rules |

---

## 3. Top bar redesign

### Left — context

- Page title from `PAGE_META` (e.g. **Dashboard**)
- Subtitle: **Demo Yard · Operational overview**

### Center — global search

- `GlobalSearch` component
- Scope tabs: All, Suppliers, Buyers, Purchases, Sales, Categories
- `Ctrl+K` focus shortcut (desktop)
- Phase 1: UI placeholder; `buildSearchApiPath()` stub in `search-types.ts`

### Right — utilities

- Notifications placeholder (badge dot)
- Quick actions dropdown (purchase, sale, inventory — permission-gated)
- User avatar + account menu (name, email, role, sign out)

---

## 4. Dashboard changes

### KPI grouping

| Group | Cards |
|-------|-------|
| **Operations** | Stock on hand (featured), Intake today, Sales today |
| **Financial settlement** | Owed to suppliers, Receivable from buyers, Paid today, Collected today |

### Layout rows

1. Operations KPI group (3-column on desktop)
2. Financial KPI group (auto-fill grid)
3. **Intel grid:** Largest outstanding | Weekly intake | Weekly sales
4. **Bottom grid:** Top moving categories | Quick actions

### Clickable destinations

| KPI | Navigates to |
|-----|----------------|
| Stock on hand | `/inventory` |
| Intake today | `/purchases` |
| Sales today | `/sales` |
| Owed to suppliers | `/suppliers?balance=owed` |
| Receivable | `/buyers?balance=receivable` |
| Paid / Collected today | `/suppliers` / `/buyers` |

Entire card is a `<Link>` with hover lift + border affordance.

---

## 5. Search foundation

```typescript
// lib/search-types.ts
type SearchScope = "all" | "suppliers" | "buyers" | "purchases" | "sales" | "categories";
interface GlobalSearchQuery { q: string; scope: SearchScope; tenantSlug: string; }
```

`GlobalSearch` holds query + scope state. Future: call `apiFetch(buildSearchApiPath(query))` when `GET /v1/search` ships.

---

## 6. Adaptive layout decisions

| Viewport | Behavior |
|----------|----------|
| **≤1100px** | Command header stacks; search full width; KPI ops single column; intel/bottom grids stack |
| **1366px** | Operations grid 1.15fr / 1fr / 1fr |
| **1440px** | Content max 1680px centered; intel grid widens outstanding panel |
| **1920px+** | Content max 1760px; financial KPIs 4-column |
| **Workspaces** | Split `1.4fr / 300–420px` — table primary, quick entry secondary |

`--content-max` CSS variable centers main column with `margin-inline: auto` — reduces empty gutters on ultrawide without stretching cards awkwardly.

---

## 7. Workspace improvements

- Page **titles** live in command header only
- Workspaces show **lead description** via `PageHeader leadOnly`
- Purchases/sales copy clarifies: recent transactions primary, quick entry secondary
- Wider secondary panel ratio on large screens
- Drawers, pagination, filters unchanged

---

## 8. Commands run

```bash
pnpm --filter @yardflow/web lint    # ✓ pass
pnpm --filter @yardflow/web build   # ✓ pass
pnpm --filter @yardflow/api test    # ✓ 38/38 pass
```

---

## 9. Remaining UX debt (before M4)

| Item | Priority |
|------|----------|
| Backend global search API | Medium — UI ready |
| Notification center | Low — placeholder only |
| Token refresh (from M3.5) | Medium — long sessions |
| Dedicated payments list route | Low |
| POS/mobile shell | M4 scope |

---

## 10. Recommendation before M4

Web UX patterns are **frozen** for POS/mobile:

1. Command header + search architecture carry forward to tablet POS top bar
2. KPI grouping maps to POS home action grid
3. Workspace split (list + quick entry) mirrors POS two-pane flows
4. Proceed to **M4 POS Foundation** on this layout foundation

---

## 11. Success criteria

| Criterion | Status |
|-----------|--------|
| Top bar premium and intentional | ✅ |
| Dashboard uses screen space intelligently | ✅ |
| KPI cards fully clickable | ✅ |
| Operational hierarchy clear | ✅ |
| Workspace layouts balanced | ✅ |
| Dashboard feels like command center | ✅ |
| Responsive behavior improved | ✅ |
| Design system intact | ✅ |
| No ledger/payment regression | ✅ 38/38 tests |

**M3.6 is complete.**
