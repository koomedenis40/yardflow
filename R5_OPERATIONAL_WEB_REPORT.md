# YardFlow — R5 Operational Web Report

**Milestone:** R5 Operational Web UI Rebuild  
**Date:** 2026-06-05  
**Base commit:** `4de2428` (R4)  
**Status:** Complete — owner operational web restored

---

## 1. Summary

R5 restores the **operations workspace** web experience on top of the R3 ledger and R4 settlement API. This is not a CRUD admin panel — it is a command-center layout with clickable KPIs, 70/30 workspaces, detail drawers, and quick payment actions.

**Not in scope:** M-Pesa, receipts, CS30, mobile, Super Admin, billing, exports.

---

## 2. Pages restored

| Route | Purpose |
|-------|---------|
| `/login` | IBM-style split login |
| `/[tenant]/dashboard` | Command center KPIs, intel, activity |
| `/[tenant]/suppliers` | Party workspace + pay supplier |
| `/[tenant]/buyers` | Party workspace + receive payment |
| `/[tenant]/purchases` | Intake workspace + drawer |
| `/[tenant]/sales` | Outbound workspace + profit snapshot |
| `/[tenant]/inventory` | Stock table + movement drawer |
| `/[tenant]/categories` | Create / deactivate categories |
| `/[tenant]/balances` | Settlement summary |
| `/[tenant]/audit` | Audit log (owner) |
| `/[tenant]/settings` | Tenant context |

---

## 3. Components restored

| Component | Role |
|-----------|------|
| `tenant-shell.tsx` | Sidebar + main column |
| `command-header.tsx` | Title, search, quick actions, user menu |
| `global-search.tsx` | Scoped search UI + Ctrl+K |
| `workspace-layout.tsx` | KPIs, filters, 70/30 split |
| `operational-table.tsx` | Sortable rows, click, loading/empty |
| `pagination-bar.tsx` | Client-side pagination |
| `detail-drawer.tsx` | Right-side drill-down |
| `kpi-link-card.tsx` | Fully clickable KPI cards |
| `kpi-group.tsx` | Section grouping |
| `trend-bars.tsx` | Weekly restraint bars |
| `party-workspace.tsx` | Suppliers/buyers + payments |
| `ledger-workspace.tsx` | Purchases/sales forms + detail |
| `inventory-workspace.tsx` | Stock + movements |
| `categories-workspace.tsx` | Category CRUD |
| `balances-workspace.tsx` | Owed / credit / receivable |

---

## 4. Dashboard architecture

Five sections (client-composed from R4 API):

1. **Operations** — total stock (featured), intake today, sales today  
2. **Financial** — supplier owed, buyer receivable, paid today, collected today  
3. **Intelligence** — largest outstanding supplier, weekly intake/sales trend bars  
4. **Activity** — recent purchases, sales, payments  
5. **Categories** — top categories by stock (chips → inventory)

Data sources: `/balances/summary`, `/inventory`, `/purchases`, `/sales`, `/supplier-payments`, `/buyer-payments`, `/balances/suppliers`.

---

## 5. Command header architecture

| Zone | Content |
|------|---------|
| Left | Page title + `{tenant} · {context}` subtitle |
| Center | Global search + scope tabs (UI stub for future API) |
| Right | Notifications placeholder, quick actions dropdown, user menu |

`Ctrl+K` focuses search. Quick actions permission-gated (purchase, sale, inventory).

---

## 6. Drawer architecture

Row click opens right `detail-drawer` (480px) with:

- **Supplier:** balances, credit, unpaid purchases, payments, quick pay form  
- **Buyer:** receivable, unpaid sales, payments, receive form  
- **Purchase/Sale:** paid, remaining, allocations, profit (sales)  
- **Inventory:** avg cost, value, recent movements  

---

## 7. Responsive behavior

| Viewport | Behavior |
|----------|----------|
| Desktop | Sidebar + command header + 70/30 workspace |
| ≥1920px | Workspace split 75/25 |
| ≤1100px | Header stacks; workspace stacks; sidebar hidden (mobile web) |

Content max-width **1440px**, centered — fixes prior large-desktop whitespace.

---

## 8. Design decisions

- **Frozen palette** from DESIGN_SYSTEM v1.0 (tokens in `globals.css`)  
- **White text on green** primary buttons (`#146B4D`)  
- **Featured stock KPI** on `#0E4F3A`  
- **Blue** for sales actions  
- **Borderless cards** on gray canvas — industrial, calm, high-trust  
- **Client-side pagination** — API lists capped; tables paginate in-browser  
- **No endless scroll** — explicit pagination bar  

---

## 9. API additions (minimal, for UI)

| Change | Reason |
|--------|--------|
| `POST/PATCH /categories` | Category management UI |
| `GET /categories?includeInactive=true` | Deactivated categories visible to owner |
| Purchase/sale list `include` relations | Party names in tables |
| Inventory movements `include` category | Drawer context |

---

## 10. Validation results

```powershell
pnpm -r build                    # Pass (api + web + packages)
pnpm --filter @yardflow/web lint # Pass
pnpm --filter @yardflow/api test # 47/47 pass
```

**Web routes built:** 12 app routes + login.

---

## 11. Commands run

```powershell
cd C:\dev\yardflow-rebuild
pnpm install
pnpm -r build
pnpm --filter @yardflow/web lint
pnpm --filter @yardflow/api test
```

---

## 12. Known limitations

- **Global search** — UI only; `buildSearchApiPath()` returns null until search API ships  
- **Server pagination** — not in R4 API; client pagination over capped lists (100 rows)  
- **Category edit** — create + deactivate only; inline edit deferred  
- **Dashboard week buckets** — client-side date bucketing (EAT via `Africa/Nairobi`)  
- **No screenshots** — run `pnpm --filter @yardflow/web dev` at `http://localhost:3000/login`  
- **Sidebar hidden on narrow viewports** — native mobile deferred to later milestone  

---

## 13. Next milestone recommendation

**R6 — M-Pesa & receipts** or **R6 — Native mobile foundation** depending on product priority. Web operational layer is ready for operators to run manual settlement end-to-end.

Login: `owner@demo.local` / `Password123!` / `demo-yard`
