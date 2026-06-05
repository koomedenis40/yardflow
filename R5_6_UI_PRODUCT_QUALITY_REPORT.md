# R5.6 — UI / Product Quality Audit & Refinement

**Status:** Complete
**Scope:** Owner web experience only. No mobile app, M-Pesa, receipts, CS30, billing, Super Admin, or new ledger/payment business logic.
**Validation:** `pnpm -r build` ✓ · `pnpm --filter @yardflow/api test` ✓ (47 passing) · `pnpm --filter @yardflow/web lint` ✓ (0 warnings) · `pnpm --filter @yardflow/web build` ✓

---

## 1. Audit — problems found

| # | Area | Problem | Severity |
|---|------|---------|----------|
| 1 | Seed data | No realistic demo data shipped in the repo. The visible "Supplier d665c48a / Buyer 699b53b7" rows were random UUID-slice names left over from e2e test runs against the shared dev DB. | P0 |
| 2 | Recent payments | Dashboard showed only `KES 500` with a timestamp — no party, type, or method. | P0 |
| 3 | Search | Scope pills (All / Suppliers / …) were always visible under the search bar, cluttering the header. | P1 |
| 4 | Drawers | Allocations, unpaid lists, recent payments, and stock movements rendered as raw `<ul>` bullets. | P1 |
| 5 | Pagination | `purchases`, `sales`, `suppliers`, `buyers`, `inventory` already paginated; **audit** and **balances** were not. | P1 |
| 6 | Wide desktop | `page-content` capped at 1440px, leaving large empty margins on 1920px screens. | P2 |
| 7 | Payment API | `/supplier-payments` and `/buyer-payments` list endpoints did not include the party name, so the UI couldn't show "who". | P0 (blocker for #2) |
| 8 | Duplicates | Activity feeds looked fake because of repeated random-ID rows (same root cause as #1). | P1 |

Areas audited and found already healthy (R5.5): login, sidebar, command-header structure, icons (Lucide, consistent stroke/size), typography tokens, KPI cards, table density, category management, settings.

---

## 2. Design changes made

### Search — focus-triggered popover (`global-search.tsx`)
- Scopes are now hidden until the field is **focused/clicked**, shown in a clean elevated popover.
- Scopes retained: All, Suppliers, Buyers, Purchases, Sales, Categories.
- `Ctrl/⌘+K` focuses and opens; `Esc` closes; click-outside closes.
- Added an inline `Ctrl K` kbd hint and contextual search hint text.

### Recent payments clarity (`dashboard/page.tsx`)
- Each row now reads e.g. **"Paid Mary Wanjiku"** / **"Collected from Nairobi Metals Ltd"** with a meta line: `KES 7,946 · Cash · Today 3:10 PM`.
- New `formatMethod()` (Cash / Bank / Mobile money / Other) and `formatDayTime()` (Today / Yesterday / 5 Jun + time) helpers in `lib/format.ts`.
- Empty states added to recent purchases / sales / payments panels.

### Drawers — structured rows/cards (`ledger-`, `party-`, `inventory-workspace.tsx`)
- Settlement / balances / stock now render as a `drawer-stats` card grid (label + value tiles).
- Allocations, unpaid items, recent payments, and stock movements render as `drawer-rows` (primary + right-aligned meta) instead of bullets.
- Stock movements show signed in/out weight deltas (green in / red out) and humanised movement types ("Purchase intake", "Sale outflow", …).
- Status badge moved into a clean header row.

### Pagination
- **Audit** and **balances**-adjacent long lists: audit page now uses client pagination via the shared `PaginationBar`. (purchases, sales, suppliers, buyers, inventory were already paginated; balances tables are pre-filtered to non-zero rows and remain short.)

### Responsiveness
- `page-content` now widens to 1680px ≥1680px viewports and 1840px ≥1920px, removing the wasted empty band on large desktops while keeping readable line lengths.
- Verified existing breakpoints: 1200px (hero/intel/activity → 2-col), 1100px (sidebar hidden, single column header), 768px (full single column, login visual hidden). Added a 900px rule for `balances-split` / `drawer-stats`.

### API (no business-logic change)
- `supplier-payments.service.list` / `buyer-payments.service.list` now `include` the party `{ id, name }` so feeds can show the counterparty.

---

## 3. Seed data changes — realism (`apps/api/prisma/demo-seed.ts`, new)

A new, idempotent demo seed reuses the **real ledger/payment endpoints over HTTP** so stock, weighted-average COGS, FIFO allocations, and balances are all computed by production code (never hand-rolled). It clears the demo tenant's transactional data, then generates:

- **8 suppliers** — Mary Wanjiku, Peter Otieno, James Mwangi, Amina Hassan, Brian Kiptoo, Grace Njeri, Samuel Kamau, Fatuma Ali.
- **6 buyers** — Nairobi Metals Ltd, Eastlands Recycling, GreenCycle Traders, Ruiru Scrap Buyers, Mombasa Steel Co, Thika Alloys Ltd.
- **Realistic category pricing** (KES/kg): Copper 640/720, Brass 400/460, Aluminium 185/215, Steel grades 22–30 buy, etc.
- **18 purchases / 12 sales** with believable weights and per-kg prices, spread over the last ~2 weeks.
- **Payment histories** producing a natural mix of paid / partial / unpaid balances.

Run with: `pnpm --filter @yardflow/api run seed:demo` (requires the dev API running).

> **Duplicates / fake-looking rows:** eliminated. The random `Supplier <hex>` rows came from the **e2e suite writing into the shared dev database** (`test/helpers/ledger-test-utils.ts`). They are not regenerated at runtime; re-running `seed:demo` after a test run restores clean data. Recommended follow-up (P2, out of scope here): point e2e tests at an isolated test database.

---

## 4. Verification (manual)

- Login → dashboard renders with real names, meaningful KPIs, and clear recent-payment lines. ✓
- Suppliers list returns exactly the 8 realistic names; payments endpoint returns `supplier.name`. ✓
- Search: pills appear only on focus, Ctrl+K works, Esc/click-outside closes. ✓
- Drawers (purchase, sale, supplier, buyer, inventory): structured cards/rows, no raw bullets. ✓
- Pagination present on purchases, sales, suppliers, buyers, inventory, audit. ✓
- Build / lint / tests all green. ✓

---

## 5. Remaining UI debt

| Item | Priority | Note |
|------|----------|------|
| e2e tests share the dev database | P2 | Pollutes demo data on `pnpm test`; isolate to a dedicated test DB. |
| Global search has no backend yet | P2 | Popover is UX-complete; results endpoint deferred (server-side search). |
| No mobile nav drawer | P2 | Sidebar hidden < 1100px; acceptable for web, native handles mobile next. |
| Server-side pagination/filtering | P2 | Lists are still client-paginated (capped at 100 from API `take`). |
| Settings page depth | P3 | Minimal; fine for current scope. |

---

## 6. Verdict — can R6 native mobile start?

**Yes.** The owner web experience is now polished, realistic, and responsive, and all API contracts the mobile app will consume (auth, ledger, payments, balances, inventory) are stable and tested. The remaining items above are non-blocking polish. R6 native mobile foundation can safely begin.
