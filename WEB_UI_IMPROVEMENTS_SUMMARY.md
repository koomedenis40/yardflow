# YardFlow — Web UI Improvements Summary

**Date:** 2026-06-06  
**Scope:** Owner web dashboard (`apps/web`) — R5 through R5.6  
**Purpose:** Close the web UI chapter before R6 native mobile architecture begins.  
**Canonical UI contracts:** `docs/DESIGN_SYSTEM.md` · `docs/UI_DIRECTION.md`

---

## 1. UI Evolution Timeline

### R5 — Operational Web Rebuilt (2026-06-05)

R5 re-created the entire owner web UI from scratch on top of the R3 ledger and R4 payment APIs. Before R5 there was no web app at all in the recovery build. The goal was to restore a functional operational command center, not pixel-perfect visual quality.

**Delivered:**
- IBM-style split-panel login at `/login`
- Fixed sidebar shell with grouped nav and permission-gated links
- Command header with page title, search input, quick actions, and user menu (`Ctrl+K` focus)
- Dashboard with five sections: operations KPIs, financial KPIs, intelligence (trends), activity feeds, category chips
- `LedgerWorkspace` for purchases and sales (70/30 split, forms, detail drawers)
- `PartyWorkspace` for suppliers and buyers with inline payment actions
- `InventoryWorkspace`, `CategoriesWorkspace`, `BalancesWorkspace`, audit page, settings stub
- Client-side pagination (`PaginationBar`) on all major tables
- Responsive collapse below 1100px (sidebar hidden, header stacks)

**Visual state at R5 ship:** Functional but not polished. Unicode placeholder icons, weak type hierarchy, generic card stacking, search pills always visible, no realistic demo data.

---

### R5.5 — Design Quality Restored (2026-06-05)

R5.5 addressed visual drift from the frozen design direction. No ledger, payment, or mobile logic was changed.

**Delivered:**
- `docs/DESIGN_SYSTEM.md` restored (frozen v1.0, the single source of truth)
- `lucide-react` added; every Unicode/emoji icon replaced with Lucide at consistent 20px / 1.75px stroke
- `components/ui/icon.tsx` wrapper for uniform icon rendering
- Full Inter type scale applied via CSS variables (`--text-display` → `--text-kpi-lg`)
- `layout.tsx` applies `inter.className` on body (previously variable-only)
- IBM split-panel login: underline inputs on field background, geometric right panel (dots, circles, diamond), full-width CTA with arrow
- Dashboard command-center redesign: featured stock KPI hero card on `#0E4F3A`, today's intake/sales stack, quick-action panel with semantic left stripes
- Activity feeds: `panel-card` + structured `activity-item` rows (no bare bullet lists)
- Weekly trend bars restored; blue variant for sales
- Table headers: neutral-100 background, uppercase caption style
- Pagination bar: "Result X–Y of Z" count copy, chevron prev/next
- Sidebar: Operations / Parties & Settlement / Administration group labels; brand tile with Package icon; green/blue active states

---

### R5.6 — Product Quality Refinement (2026-06-05)

R5.6 fixed the remaining product-quality gaps: realistic demo data, meaningful payment display, search UX, drawer structure, pagination coverage, and wide-desktop layout.

**Delivered:**

| Problem | Fix |
|---------|-----|
| Random UUID supplier/buyer names from e2e test runs | New `demo-seed.ts` via real HTTP API — 8 named suppliers, 6 named buyers, 18 purchases, 12 sales, mixed payment states |
| Recent payments showing only `KES 500` + timestamp | "Paid Mary Wanjiku" format with `KES 7,946 · Cash · Today 3:10 PM` (`formatMethod` + `formatDayTime` helpers) |
| Search scope pills always visible, cluttering header | Focus-triggered popover: scopes appear only on field focus/click; `Esc` and click-outside close |
| Drawers rendering allocations/movements as raw `<ul>` bullets | `drawer-stats` card grid for summary figures; `drawer-rows` for allocations, unpaid items, payments, movements |
| Audit page had no pagination | Client-side `PaginationBar` added to audit |
| 1440px content cap leaving empty margins on large screens | Widened to 1680px ≥1680px viewports and 1840px ≥1920px |
| Payment list API missing party name | `supplier-payments` and `buyer-payments` list endpoints now include party `{ id, name }` |
| Stock movements showing raw type codes | Humanised labels: "Purchase intake", "Sale outflow"; signed weight deltas green in / red out |

---

## 2. What Improved

### Login
- IBM split-panel design: 480px left form column, geometric right panel
- Underline inputs on gray field background (not boxed generic form)
- "Log in to YardFlow" headline at `--text-display` (32px / weight 600)
- Full-width CTA with ArrowRight Lucide icon
- Responsive: right panel hidden below 768px

### Sidebar
- Grouped navigation: **Operations** (Dashboard, Purchases, Sales, Inventory) · **Parties & Settlement** (Suppliers, Buyers, Categories, Balances) · **Administration** (Audit, Settings)
- Lucide icons per section with semantic active tones (green for purchase/inventory, blue for sales, neutral for others)
- Brand tile: Package icon on `--green-800` square, "YardFlow" wordmark
- Mint wash background (`--green-50` / `#F4FAF7`) — industrial calm, not aggressive
- Hidden below 1100px (no mobile drawer — native app handles mobile navigation)

### Command Header
- Three-zone grid: page title + tenant subtitle | global search | action buttons
- 72px min-height; icon buttons 40×40px
- Bell (notifications placeholder), Plus with dropdown (quick actions, permission-gated), user avatar menu
- Collapses to single column below 1100px

### Search Behavior
- Input with inline Search icon; `Ctrl/⌘+K` keyboard shortcut
- Scope pills (All · Suppliers · Buyers · Purchases · Sales · Categories) hidden until focused
- Elevated popover on focus, `Esc` and click-outside close
- Inline `Ctrl K` kbd hint and contextual placeholder text
- Backend not implemented; hint text says "integration coming soon"

### Dashboard
- **Hero row** (3-column at 1200px+): featured stock KPI on dark green card · today's intake + sales stack · quick actions panel
- Quick actions with semantic left border stripe (green = purchase, blue = sale)
- Financial settlement KPI group: supplier owed, buyer receivable, paid today, collected today — with Lucide icons
- Intelligence section: largest outstanding supplier, weekly intake and sales trend bars
- Activity feeds: recent purchases, sales, and payments as structured `panel-card` rows
- Category chips linking to inventory
- Empty states added to all activity panels

### KPI Cards
- `kpi-link-card.tsx`: fully clickable, navigates to the relevant workspace on click
- Optional icon slot for semantic identity
- Featured stock KPI: `--text-kpi-lg` (36px / weight 600) on `#0E4F3A` background, white text
- Financial KPIs: `--text-kpi` (28px / weight 600) on white cards

### Tables
- Dense operational table: 40px row height, borderless on gray canvas
- Column headers: `--text-caption` (12px / weight 500 / uppercase / letter-spacing 0.06em) on neutral-100 background
- Lucide ChevronUp/ChevronDown sort indicators
- Row click opens detail drawer; selected row highlight
- Empty and loading states handled

### Drawers
- Right-side overlay (480px) with `backdrop-filter: blur(4px)`
- `drawer-stats` card grid: label + value tiles for summary figures (balance owed, credit, stock value)
- `drawer-rows`: primary text + right-aligned meta line for allocations, unpaid items, payments, movements
- Structured status badge in clean header row
- Lucide X close button; neutral header band

### Payments Display
- Recent payments: "Paid {party}" / "Collected from {party}" label
- Meta line: `KES {amount} · {method} · {day/time}` using `formatMethod()` and `formatDayTime()`
- Methods displayed as: Cash / Bank / Mobile money / Other (not raw enum values)
- Day/time: Today 3:10 PM / Yesterday 11:45 AM / 5 Jun 2:30 PM
- Allocation rows in drawer: purchase/sale reference + amount + allocation date

### Seed Data Realism
- `demo-seed.ts` calls the real API over HTTP (production ledger code)
- 8 suppliers with Kenyan names (Mary Wanjiku, Peter Otieno, James Mwangi, Amina Hassan, Brian Kiptoo, Grace Njeri, Samuel Kamau, Fatuma Ali)
- 6 buyers with business names (Nairobi Metals Ltd, Eastlands Recycling, GreenCycle Traders, Ruiru Scrap Buyers, Mombasa Steel Co, Thika Alloys Ltd)
- Realistic KES/kg category pricing (Copper 640 buy / 720 sell, Brass 400/460, Aluminium 185/215, Steel 22–30 buy)
- 18 purchases / 12 sales with believable weights and prices over ~2 weeks
- Mixed payment states: paid, partial, unpaid — natural distribution

### Pagination
- `PaginationBar` component: page size selector (10/25/50), prev/next with Lucide chevrons, "Result X–Y of Z" count
- Client-side `paginateClient()` utility in `lib/types.ts`
- Active on: purchases, sales, suppliers, buyers, inventory, audit (added R5.6)
- Balances tables pre-filter to non-zero rows (short by design)

### Responsiveness
- Desktop: full sidebar + command header + 70/30 workspace split
- ≥1680px: content widens to 1680px (R5.6)
- ≥1920px: content widens to 1840px (R5.6)
- ≤1200px: hero row and intel/activity grids collapse to 2-column
- ≤1100px: sidebar hidden; command header stacks to single column; workspace 70/30 collapses
- ≤900px: balances split and drawer stats stack vertically
- ≤768px: single column; login right panel hidden

### Icons
- Sole icon library: `lucide-react` — no Unicode characters, no emoji, no SVG sprite
- `icon.tsx` wrapper enforces 20px size and 1.75px stroke width globally
- Icon vocabulary: LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Package, Users, ShoppingCart, Scale, Coins, Settings, ChevronUp/Down/Left/Right, Bell, Plus, X, ArrowRight, Search, BarChart2, AlertCircle

### Typography
- Font: Inter via `next/font/google` (subset: latin), applied on `<body>` via `inter.className`
- `font-feature-settings: "cv01","cv02","cv03","cv04","cv11","ss01"` for Inter optical improvements
- Nine-level scale from `--text-display` (32px) to `--text-kpi-lg` (36px)
- Page titles: one `--text-h1` per view; no competing headlines
- Table headers: `--text-caption`, uppercase, muted color
- KPI values: `--text-kpi` or `--text-kpi-lg` depending on prominence

---

## 3. Current Web Design Principles

### IBM-style restraint
The UI is modeled on mission-critical operational software — IBM Carbon, Fixoria, Foodtrack — not SaaS marketing templates. Every visual decision defaults to restraint. White canvas, charcoal text, borderless cards, minimal decorative elements. The geometric shapes on the login panel are the strongest "visual" element; everything else is structure.

### Professional operational software
YardFlow is a ledger and operations tool for scrap-yard owners. The visual language communicates trust, density, and clarity — not playfulness or personality. Operators scan KPIs, check balances, and record transactions. Every pixel should serve that workflow.

### Not AI-looking
No gradients on chrome, no glassmorphism, no neon accents, no random purple/orange. The palette is a professional tricolor: green (purchase/stock/confirm), blue (sale/info), red (destructive). Amber for warnings. Everything else is neutral.

### No generic admin feel
Admin templates rely on repeated card grids with icons, colorful stats, and charts everywhere. YardFlow avoids this. The dashboard has a single featured KPI (hero), supporting KPIs in a group, and operational data feeds — not a scatter of widgets. Workspaces are dense tables with a detail drawer, not card galleries.

### Professional icons
Lucide React is the sole icon library. No Unicode arrows, no emoji hands, no SVG sprites from multiple sources. Consistent 20px / 1.75px stroke. Icons serve navigation and semantic role identity (green nav icon = purchase area, blue = sales area), never decoration.

### Inter typography
Inter is the only typeface. Nine-level scale defined by CSS custom properties. The scale maps directly to function: display for login, h1 for page title, caption for table headers, kpi-lg for hero metric. No free-form font sizes outside the scale.

### Semantic colors
Colors encode business semantics:
- Green = purchases, stock in, primary confirm actions
- Blue = sales, stock out, secondary actions
- Red = destructive actions, oversell, error states
- Amber = partial payment, pending, low stock warnings
- Neutral = chrome, dividers, muted meta

No color is used decoratively. A green number means stock increased. A red number means a balance is owed or an error occurred. This consistency lets operators read state at a glance.

### Structured drawers
Detail drawers are the primary drill-down mechanism. They are not modal dialogs — they slide in from the right and remain alongside the table. Drawer content uses a card grid (`drawer-stats`) for summary figures and structured rows (`drawer-rows`) for list data. Raw `<ul>` bullet lists are forbidden in drawers.

### Pagination over endless scrolling
All tables use explicit `PaginationBar` controls with page-size selection. Endless scroll is explicitly rejected — operators need to know where they are in a list, and they need to be able to navigate to a specific page. Pagination is always visible at the bottom of the table shell.

---

## 4. Current Remaining UI Debt

The following issues are documented honestly. Some are confirmed, some are reported but unmeasured.

### Dashboard and audit page scroll (unmeasured — P1)
The owner reported unwanted vertical scrolling below the last visible content on the Dashboard and Audit pages at large viewports. This was **not measured or fixed** in R5.5 or R5.6. The suspected cause is that `.app-shell` uses `min-height: 100vh` without a scroll container cap, and the dashboard stacks five sections via `.dashboard-sections` with no viewport height constraint. The audit page renders its table in a bare `<div>` rather than inside a `workspace-layout` wrapper. Workspace pages (purchases, sales, suppliers) that use `workspace-layout` do not exhibit this issue.

**Recommended diagnosis:** Open Dashboard and Audit at 1920×1080 and 1366×768; measure scroll height vs. content height; compare with purchases page. If confirmed, wrap audit in `workspace-layout` and add a viewport-constrained scroll container to the dashboard sections.

### Search backend not integrated (confirmed — P2)
The search popover is UX-complete (scopes, keyboard, focus/dismiss). The `buildSearchApiPath()` function returns `null` and the hint text says "integration coming soon." No `/search` or scoped search endpoints exist in the API. Search is a UI stub.

### Server-side pagination not complete (confirmed — P1)
The API returns a maximum of 100 rows per list endpoint (`take: 100`). The web paginates those rows client-side. This works for current demo data volumes but will break at scale. A proper server-side paginated list-query contract was specified in M2.5 but was not rebuilt.

### Login form position on wide screens (unmeasured — P2)
The login page uses a fixed 480px left column with `max-width: 380px` on the form. On very wide screens the form may appear left-aligned rather than centered within the panel. This was reported but not reproduced or measured.

### Mobile web not a priority (by design — P3)
The sidebar is hidden below 1100px and there is no mobile navigation drawer. This is intentional: native mobile is handled by the R6 `apps/pos` Expo app, not the web app. The web app is an owner review surface, not a field-use tool.

### e2e tests pollute demo database (confirmed — P2)
The API e2e test suite creates `Supplier <hex>` rows in the shared dev database via `ledger-test-utils.ts`. Running `pnpm test` followed by `pnpm dev` will show test-generated rows in the UI. Running `seed:demo` after each test run restores clean data. The proper fix is pointing e2e tests at an isolated test database (not yet implemented).

### Corrections and stock adjustment UI (confirmed — P1)
The API endpoints exist (`corrections.controller.ts`, `POST /inventory/adjustments`) but there is no web UI for owner corrections or physical stock adjustments. The owner currently cannot correct a mislabeled purchase or record a physical count adjustment from the web app.

### Balances-adjacent pages use short client lists (minor — P3)
Balances tables pre-filter to non-zero rows and remain short in practice. This is acceptable but relies on the data volume staying low.

---

## 5. Mobile Design Inheritance

The R6 native mobile app (`apps/pos`) must carry these design principles forward. This is not optional polish — it is the contract for visual consistency between the web owner dashboard and the cashier POS.

### Typography
- Use Inter or a system font with matching optical metrics (San Francisco on iOS, Roboto on Android are acceptable system fallbacks)
- Mirror the same semantic scale: body minimum 16px on inputs (mobile legibility), KPI labels at 14px medium, action button text at 16px/600
- No exotic typefaces; no condensed display fonts

### Semantic color palette
The complete color contract from `docs/DESIGN_SYSTEM.md` applies to mobile. Extract as `packages/theme` before first R6 commit:
- Green = purchases, stock in, primary confirm
- Blue = sales, secondary actions, info
- Red = destructive, oversell, errors
- Amber = partial payment, pending, low stock
- Neutral-900 charcoal on white canvas

### Professional icons
- Use the same Lucide icons (or the React Native compatible port)
- Do not introduce Heroicons, Material Icons, or emoji icons
- Consistent stroke weight and sizing

### Card hierarchy
- No flat list of equal-weight items; use visual weight to communicate importance
- Home screen: primary actions (Buy / Sell) occupy top-tier real estate with 48dp minimum touch targets
- Summary cards carry KPI labels and values using the same caption/kpi token pattern
- No arbitrary card borders or drop shadows on every element

### Payment clarity
- Payment rows must show: counterparty name, amount in KES, method (Cash/Bank/Mobile money), status badge
- Never show raw payment IDs; never show raw enum values
- Partial status shown with amber badge; paid with green; unpaid with neutral

### Realistic data labels
- Never display raw database IDs as user-facing text
- Party names must always be resolved (first/last name or business name)
- Category names, not codes
- Movement types humanised: "Purchase intake" not "PURCHASE_IN"

### No raw IDs
No UUID fragments as user-visible identifiers anywhere in the UI. If a reference number is needed, use a human-readable sequence or short code.

### No raw bullet lists
Structured rows with label + meta + right-aligned value replace bare `<ul>` lists. This applies to payment history, allocation lists, stock movement logs, and any list inside a drawer or detail screen.

### No endless scroll as primary navigation
The cashier POS should use bottom tab navigation, not an infinite scroll feed. Long lists use explicit "Load more" or paginated views. The operator must always know where they are.

### Operations-first UX
The POS exists to record transactions fast. Every screen should reduce cognitive load for the cashier:
- Primary action always prominent and above the fold
- Form fields in logical order (category → weight → price → supplier)
- Confirmation screen shows the key numbers before commit
- Error states are immediate and specific (not generic "something went wrong")
- No decorative loading animations that delay perceived response
