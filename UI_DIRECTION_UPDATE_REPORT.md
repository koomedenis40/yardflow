# YardFlow — UI Direction Update Report

**Date:** 2026-06-03  
**Scope:** Web dashboard polish + UI documentation (no ledger / API logic changes)

---

## 1. Summary

YardFlow’s web UI was refreshed to reflect a **mobile-first, modern operational** product: light canvas, black/white contrast, soft rounded cards, KPI widgets, and a clearer owner shell. Documentation now defines POS and Super Admin directions for future milestones.

---

## 2. Files changed

### Web (`apps/web`)

| File | Change |
|------|--------|
| `src/app/globals.css` | Design tokens, layout, KPI, tables, forms, login, activity list |
| `src/components/tenant-shell.tsx` | Sidebar + topbar, active nav, ops-first order |
| `src/components/ui/page-header.tsx` | **New** — page titles & actions |
| `src/components/ui/kpi-card.tsx` | **New** — metric cards |
| `src/components/ui/data-table.tsx` | **New** — styled tables |
| `src/components/ui/empty-state.tsx` | **New** |
| `src/components/ui/loading-state.tsx` | **New** |
| `src/components/ui/panel-card.tsx` | **New** |
| `src/components/party-list-page.tsx` | Refactored to shared UI |
| `src/components/ledger-transaction-page.tsx` | Refactored to shared UI |
| `src/app/login/page.tsx` | Light login layout |
| `src/app/[tenantSlug]/dashboard/page.tsx` | KPIs, quick actions, recent activity |
| `src/app/[tenantSlug]/categories/page.tsx` | Header, badges, data table |
| `src/app/[tenantSlug]/inventory/page.tsx` | KPI strip + table + empty state |

### Documentation

| File | Change |
|------|--------|
| `docs/UI_DIRECTION.md` | **New** — full UI source of truth |
| `docs/README.md` | Link to UI_DIRECTION |
| `docs/SYSTEM_RULES.md` | §25 Client applications + UI link |
| `PRD.md` | §16 UI/UX direction |
| `ARCHITECTURE_REVIEW.md` | Pointer to UI_DIRECTION.md |

### Root

| File | Change |
|------|--------|
| `package.json` | (unchanged this pass; `dev:fresh` from prior session) |

---

## 3. Design decisions

| Decision | Rationale |
|----------|-----------|
| Light theme for web | Owner review / printing; matches inspiration contrast without dark-only fatigue |
| Black featured KPI | Highlights primary metric (stock kg) like reference “inverted” card |
| Green brand accent | Scrap / “go” actions (sign in, record) distinct from neutral black chrome |
| Sidebar + topbar | Web needs multi-section navigation; POS will use bottom nav per UI_DIRECTION |
| Ops-first nav order | Purchases & sales before static master data |
| Client-side KPI aggregation | Uses existing list endpoints; no new report APIs or ledger changes |
| Unicode nav icons | Avoid new icon dependency; replace with proper icons in M4 if needed |
| Shared `DataTable` / `PageHeader` | Consistent lists across M2 pages |

---

## 4. Pages improved

| Page | Improvements |
|------|----------------|
| **Login** | Gradient background, branded card, green CTA |
| **Dashboard** | 6 KPI cards, quick actions (buy/sell/stock), recent activity list |
| **Suppliers / Buyers** | Panel form, empty states, data table |
| **Purchases / Sales** | Panel form, payment badges, empty/setup states |
| **Inventory** | Summary KPIs, styled stock table |
| **Categories** | Status badges, cleaner table |
| **Shell** | Sidebar branding, active states, topbar title |

---

## 5. Intentionally not implemented

| Item | Reason |
|------|--------|
| React Native / Expo POS app | M4 milestone |
| Bottom navigation on web | Reserved for POS; web uses sidebar |
| Super Admin routes & widgets | Not scaffolded in API/web |
| Charts (line/bar/area) | No report APIs; placeholders deferred to M5 |
| Dark mode toggle | Out of scope |
| Category/supplier edit UI | API supports update; UI remains list + create only |
| Stock adjustment form | Owner-only API; no web form yet |
| Custom font / icon pack | Minimize dependencies |
| Ledger, auth, or API changes | Per requirement |

---

## 6. Next UI milestone recommendation

**M4 — Receipts & POS shell**

1. Expo app with bottom nav (Home, Buy, Sell, Pay, More)  
2. Category grid with live stock badges (read `/inventory`)  
3. Purchase/sale flows mirroring web validation schemas  
4. Receipt print confirmation screen  
5. Optional: port design tokens from `globals.css` to POS theme object  

**M5 — Reports**

- Trend charts on owner dashboard  
- Export actions  
- Stock movement timeline per category  

**M6 — Super Admin web**

- `/admin` layout reusing web component patterns  
- Tenant table, billing status, platform KPIs  

---

## 7. Verify locally

```powershell
pnpm dev:fresh
# http://localhost:3000/login
```

Sign in as `owner@demo.local` / `Password123!` / `demo-yard` and review dashboard + operational pages.
