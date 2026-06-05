# YardFlow — Design System Update Report

**Date:** 2026-06-03  
**Version:** Design System v1.0 (frozen)  
**Scope:** Documentation + web UI tokens only — no ledger, API, or DB changes

---

## 1. Summary

YardFlow now has a **frozen design system** (`docs/DESIGN_SYSTEM.md`) and a refactored web app that implements it: IBM-style login restraint, operational green/blue semantics, Inter typography, calm spacing, and mission-control dashboard hierarchy.

---

## 2. Files created

| File | Purpose |
|------|---------|
| `docs/DESIGN_SYSTEM.md` | Full frozen system (A–L): personality, type, color, spacing, cards, buttons, tables, dashboard, POS, icons |
| `DESIGN_SYSTEM_UPDATE_REPORT.md` | This report |

---

## 3. Files updated

| File | Change |
|------|--------|
| `apps/web/src/app/globals.css` | Complete token rewrite per DESIGN_SYSTEM v1.0 |
| `apps/web/src/app/layout.tsx` | Inter via `next/font/google` |
| `apps/web/src/app/login/page.tsx` | Split-panel IBM-style login |
| `apps/web/src/components/tenant-shell.tsx` | Green sidebar wash, semantic nav tones |
| `apps/web/src/components/ui/kpi-card.tsx` | `kpi-card--featured` (green hero, not black) |
| `apps/web/src/app/[tenantSlug]/dashboard/page.tsx` | Semantic quick actions + activity avatars |
| `apps/web/src/components/party-list-page.tsx` | Primary button token |
| `apps/web/src/components/ledger-transaction-page.tsx` | Semantic badges |
| `apps/web/src/app/[tenantSlug]/categories/page.tsx` | Badge classes |
| `docs/UI_DIRECTION.md` | Points to DESIGN_SYSTEM as canonical |
| `docs/README.md` | DESIGN_SYSTEM link |
| `docs/SYSTEM_RULES.md` | Client apps reference |
| `PRD.md` | §16 source of truth link |

---

## 4. Design decisions

| Decision | Rationale |
|----------|-----------|
| **Inter** | Modern operational clarity; matches enterprise references |
| **Charcoal `#161616` on light gray canvas** | IBM-style restraint; avoids generic dark admin |
| **Green featured KPI** | Stock is hero metric; white text on `#0E4F3A` |
| **Green = purchase/stock; blue = sale** | Semantic consistency web → POS |
| **Primary buttons always white on green** | Accessibility + user requirement |
| **Borderless cards** | Surface contrast only; reduces “template” noise |
| **IBM split login** | Enterprise trust; dot-grid visual (no stock imagery) |
| **Mint sidebar `#F4FAF7`** | COINest-inspired calm; active states tinted green/blue |
| **Dense tables 12×16px padding** | Operational speed under pressure |
| **No gradients/glass on chrome** | Calm operational confidence |

---

## 5. Palette (frozen)

| Role | Hex |
|------|-----|
| Canvas | `#F7F8FA` |
| Surface | `#FFFFFF` |
| Text | `#161616` |
| Muted | `#8D9196` |
| Border | `#E8EAED` |
| Green primary | `#146B4D` (buttons), `#0E4F3A` (featured KPI) |
| Blue sale/info | `#0043CE`, `#0F62FE` (focus) |
| Red destructive | `#DA1E28` |
| Amber pending | `#FCF4D6` / `#8A6800` text |

---

## 6. Typography

- **Family:** Inter  
- **Page title:** 24px / 600  
- **KPI value:** 28px; hero 36px on featured card  
- **Body / table:** 14px  
- **Caption / headers:** 12px uppercase in tables  

---

## 7. Layout rules

- Max content width **1280px**  
- Section gap **32px** (`--space-8`)  
- Dashboard order: header → KPIs → quick actions → activity  
- Sidebar **252px**, green-50 background  
- Login: **480px** form column + visual panel (hidden &lt; 900px)  

---

## 8. Pages refactored

- Login  
- Dashboard  
- Purchases / Sales (shared ledger component)  
- Inventory  
- Suppliers / Buyers (shared party component)  
- Categories  
- App shell (all tenant routes)  

---

## 9. Remaining UI debt

| Item | Notes |
|------|--------|
| Unicode nav icons | Replace with Lucide in v1.1 |
| `packages/theme` shared tokens | Needed before POS repo |
| Charts / analytics widgets | M5 |
| Super Admin shell | M6 |
| Dark mode | Out of scope |
| Category/party edit forms | Still create-only |
| ESLint config | Using `tsc` for lint |

---

## 10. Recommended next UI milestone

**M4 — POS theme package**

1. Extract CSS variables to `packages/theme/tokens.json`  
2. React Native StyleSheet mirror  
3. Bottom nav + home grid using same green/blue semantics  
4. Icon pack (Lucide) shared naming with web  

Until then: **do not add colors or spacing outside `DESIGN_SYSTEM.md`.**

---

## 11. Verify

```powershell
pnpm dev:fresh
# http://localhost:3000/login
pnpm --filter @yardflow/web lint
```
