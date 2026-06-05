# YardFlow Design System

**Status:** Frozen v1.0 — source of truth for all UI  
**Scope:** Web owner dashboard (implemented), POS/mobile (specified)  
**Related:** [UI_DIRECTION.md](./UI_DIRECTION.md) (product flows) · [PRD.md](../PRD.md) §16

Do not introduce colors, spacing, or components outside this document without updating it first.

---

## A. Brand personality

| Keyword | Meaning in UI |
|---------|----------------|
| **Operational** | Numbers, status, and actions first — not marketing copy |
| **Industrial** | Restrained palette, structure, grid discipline |
| **Trustworthy** | Predictable hierarchy, no visual tricks |
| **Calm** | Generous whitespace, low visual noise |
| **Efficient** | Dense tables, scannable KPIs |
| **Modern** | Inter type, soft radii, flat surfaces |
| **Dense but readable** | Tight row height with clear labels |

**Voice:** YardFlow is mission control for scrap movement — logistics, not fintech.

**Avoid:** Gradients on chrome, glassmorphism, neon accents, random purple/orange, black text on saturated buttons, decorative borders on every card.

---

## B. Typography

**Family:** [Inter](https://fonts.google.com/specimen/Inter) (web via `next/font`). POS may use system UI with matching metrics.

| Token | Size | Weight | Line height | Use |
|-------|------|--------|-------------|-----|
| `--text-display` | 2rem (32px) | 600 | 1.2 | Login headline |
| `--text-h1` | 1.5rem (24px) | 600 | 1.25 | Page title |
| `--text-h2` | 1.125rem (18px) | 600 | 1.3 | Panel title, topbar |
| `--text-h3` | 0.9375rem (15px) | 600 | 1.35 | Section label |
| `--text-body` | 0.875rem (14px) | 400 | 1.5 | Body, table cells |
| `--text-body-sm` | 0.8125rem (13px) | 400 | 1.45 | Secondary meta |
| `--text-caption` | 0.75rem (12px) | 500 | 1.4 | KPI label, table header |
| `--text-kpi` | 1.75rem (28px) | 600 | 1.1 | KPI value |
| `--text-kpi-lg` | 2.25rem (36px) | 600 | 1.05 | Hero KPI (stock) |

**Rules:**

- Page titles: one `--text-h1` per view; no competing headlines.
- Table headers: `--text-caption`, uppercase, letter-spacing `0.06em`, muted color.
- KPI labels: caption style; values use `--text-kpi` or `--text-kpi-lg`.
- Mobile POS: body minimum 16px on inputs; KPI/tap labels 14px medium.

---

## C. Color system

### C.1 Neutral base

| Token | Hex | Usage |
|-------|-----|--------|
| `--neutral-0` | `#FFFFFF` | Cards, inputs, sidebar on white |
| `--neutral-50` | `#F7F8FA` | App canvas |
| `--neutral-100` | `#F2F4F6` | Sidebar tint, table header bg |
| `--neutral-200` | `#E8EAED` | Dividers (sparse) |
| `--neutral-400` | `#8D9196` | Muted text, placeholders |
| `--neutral-700` | `#393939` | Secondary text |
| `--neutral-900` | `#161616` | Primary text (charcoal) |

### C.2 Operational green (purchase, stock, success, primary confirm)

| Token | Hex | Usage |
|-------|-----|--------|
| `--green-900` | `#0E4F3A` | Featured KPI background |
| `--green-800` | `#146B4D` | Primary button default |
| `--green-700` | `#17835C` | Primary button hover |
| `--green-100` | `#E8F5EF` | Active nav (purchase), success badge bg |
| `--green-50` | `#F4FAF7` | Sidebar wash |

**Rule:** On `--green-800` and darker: **text/icons must be white** (`#FFFFFF`).

### C.3 Operational blue (sale, info, links, IBM-style focus)

| Token | Hex | Usage |
|-------|-----|--------|
| `--blue-700` | `#0043CE` | Sale actions, info primary |
| `--blue-600` | `#0F62FE` | Focus ring, login CTA optional accent |
| `--blue-100` | `#EDF5FF` | Active nav (sales), info badge bg |
| `--blue-50` | `#F6FAFF` | Subtle info panels |

**Rule:** On `--blue-700` and darker: **white text only**.

### C.4 Operational red (destructive, failed, oversell)

| Token | Hex | Usage |
|-------|-----|--------|
| `--red-700` | `#DA1E28` | Destructive button, error text |
| `--red-100` | `#FFF1F1` | Failed badge background |

### C.5 Warning amber (pending, partial, low stock)

| Token | Hex | Usage |
|-------|-----|--------|
| `--amber-800` | `#8A6800` | Warning badge text |
| `--amber-100` | `#FCF4D6` | Pending / partial badge bg |

### C.6 Semantic mapping

| Meaning | Color | Example |
|---------|-------|---------|
| Purchase / intake | Green | Buy quick action, purchase nav active |
| Sale / outflow | Blue | Sell quick action, sale nav active |
| Stock / inventory | Green (featured KPI) | Dashboard hero metric |
| Success / paid | Green soft badge | `paid` status |
| Pending / partial | Amber badge | `partial`, `unpaid` |
| Failed / error | Red | API errors, `failed` (future) |
| Neutral chrome | Neutral | Dashboard, suppliers, categories |

### C.7 Forbidden combinations

- Charcoal or black text on `--green-700+` or `--blue-700+` buttons
- More than one featured KPI per viewport
- Purple, pink, or gradient text on operational screens
- Red and green badges adjacent without label (color-blind risk — always include text)
- Heavy box-shadow + heavy border on the same card

---

## D. Spacing system

Base unit: **4px**. Use named steps only.

| Token | Value | Use |
|-------|-------|-----|
| `--space-1` | 4px | Icon gaps |
| `--space-2` | 8px | Inline gaps |
| `--space-3` | 12px | Form field internal |
| `--space-4` | 16px | Card padding compact |
| `--space-5` | 20px | Nav item padding |
| `--space-6` | 24px | Card padding default, grid gap |
| `--space-8` | 32px | Section gap |
| `--space-10` | 40px | Page header margin |
| `--space-12` | 48px | Login panel padding |
| `--space-16` | 64px | Login section breathing room |

**Dashboard rhythm:** `--space-8` between sections; `--space-6` inside cards.  
**Tables:** cell padding `12px 16px` (dense operational).  
**Mobile POS:** minimum tap target **48px**; screen padding `--space-4`.

---

## E. Card system

| Type | Class | Rules |
|------|-------|-------|
| **Surface card** | `.card` | White on `--neutral-50`; no border; radius `12px`; padding `--space-6` |
| **Panel** | `.panel-card` | Section container; optional `.panel-card-title` (h3) |
| **KPI default** | `.kpi-card` | White; label caption; value `--text-kpi` |
| **KPI featured** | `.kpi-card--featured` | `--green-900` bg; white text |
| **Quick action** | `.quick-action` | White; left 3px semantic stripe; no shadow at rest |
| **Empty** | `.empty-state` | Centered; no border |
| **List row** | `.activity-item` | Divider only between rows |

**Radius:** `--radius-sm` 8px (buttons, inputs), `--radius-md` 12px (cards), `--radius-full` pills.

**Shadow:** `--shadow-subtle` only for hover on quick actions; never on static KPIs.

---

## F. Button system

| Variant | Class | Background | Text |
|---------|-------|------------|------|
| Primary (confirm, save) | `.btn-primary` | `--green-800` | White |
| Secondary | `.btn-secondary` | White | `--neutral-900`; border `--neutral-200` |
| Info / sale CTA | `.btn-info` | `--blue-700` | White |
| Destructive | `.btn-destructive` | `--red-700` | White |
| Ghost | `.btn-ghost` | Transparent | `--neutral-700` |

**Mobile quick action (POS):** min-height 56px; full-width in grid; icon 24px above label.

**Focus:** 2px `--blue-600` outline, 2px offset.

---

## G. Table system

- Font: `--text-body` (14px)
- Header: `--text-caption`, uppercase, bg `--neutral-100`
- Row height: ~44px (padding 12px 16px)
- Row hover: `--neutral-50`
- No vertical borders
- Wrapper: `.table-shell` — white surface, radius 12px, overflow auto
- **Status chips:** `.badge`, `.badge--paid`, `.badge--partial`, `.badge--unpaid`

**Mobile:** horizontal scroll; sticky first column optional in POS (future).

---

## H. Dashboard layout

**Metaphor:** Mission control — stock first, flows second, directory last.

**Order:**

1. Command hero row (featured stock + today's flows + quick actions)
2. Financial settlement KPIs
3. Intelligence grid (outstanding, trends)
4. Activity feed + category strip

**Grid:** KPI `minmax(200px, 1fr)`; max content width **1440px**.  
**Topbar:** Command header — title, search, utilities.  
**Sidebar:** `--green-50` background; active item uses semantic tint (green or blue by section).

**Responsive:** Sidebar hidden ≤1100px; hero row stacks.

---

## I. Mobile / POS (shared language)

Must use **same hex tokens** (CSS variables or theme object).

| Pattern | Spec |
|---------|------|
| Bottom nav | 5 items: Home, Buy, Sell, Pay, More — height 56px + safe area |
| Home grid | 2×2 large actions: Buy (green), Sell (blue), Pay, Stock |
| Category pick | Grid tiles; name + kg badge; 3 columns phone |
| Stock card | Category name, kg large, avg cost small |
| Receipt done | Full-screen white; green check; primary "New transaction" |
| Settings | Grouped sections (Account, Yard, Sync, Support) — IBM-style lists |

---

## J. Iconography

- **Library:** Lucide React (web v1.1+)
- Size: 20px inline/nav, 24px quick actions
- Stroke: 1.75px consistent
- No emoji, no filled decorative icons in production UI
- Color: inherit text color; semantic buttons use white icons

---

## K. Implementation map (web)

| File | Role |
|------|------|
| `apps/web/src/app/globals.css` | All tokens + components |
| `apps/web/src/app/layout.tsx` | Inter font |
| `apps/web/src/components/ops/*` | Operational chrome |
| `lucide-react` | Icon pack |

When adding POS (React Native), mirror tokens in `packages/theme` (future).

---

## L. Change control

1. Propose change in PR with `DESIGN_SYSTEM.md` diff.
2. Update `globals.css` tokens in same PR.
3. Note in `DESIGN_SYSTEM_UPDATE_REPORT.md` or `R5_5_DESIGN_RESTORATION_REPORT.md` for major releases.

**Frozen:** 2026-06-03 (v1.0) · **Icons v1.1:** 2026-06-05 (R5.5 Lucide)
