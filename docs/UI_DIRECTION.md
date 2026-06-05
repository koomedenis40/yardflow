# YardFlow — UI Direction

**Status:** Product UX flows (visual tokens frozen in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md))  
**Version:** 1.1  
**Related:** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [PRD.md](../PRD.md) · [ARCHITECTURE_REVIEW.md](../ARCHITECTURE_REVIEW.md) § I

> **Canonical palette, typography, spacing, and components:** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) v1.0 (frozen).

---

## 1. Product stance

YardFlow is **mobile / POS-first**. Clerks spend most time on a phone or tablet at the scale. The **web app** is a polished **owner review** and **platform admin** surface — not a replacement for POS speed.

| Surface | Primary user | Goal |
|---------|--------------|------|
| **POS (future)** | Cashier | ≤30s purchase/sale → print receipt |
| **Tenant web** | Owner / manager | Review stock, parties, history, settings |
| **Platform web (future)** | Super Admin | Tenants, billing, health |

Design inspiration: clean mobile dashboards with **high white/black contrast**, **soft rounded cards**, **card KPIs**, **bottom navigation** on mobile, and **grouped settings** — adapted for scrap-yard operations (not a literal copy of reference UIs).

---

## 2. Visual language (web + POS)

See **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** for hex values, forbidden combinations, and component specs. Summary:

- **Neutrals:** white canvas `#F7F8FA`, charcoal text `#161616`
- **Green:** purchases, stock, primary confirm (white text on buttons)
- **Blue:** sales, informational actions
- **Amber / red:** pending and destructive semantics
- **Inter** typography; borderless cards on gray canvas

---

## 3. Tenant web (implemented baseline)

**Shell:** Fixed sidebar + topbar, responsive collapse on narrow viewports.

**Nav order (operations-first):** Dashboard → Purchases → Sales → Inventory → Suppliers → Buyers → Categories.

**Pages:**

| Route | Purpose |
|-------|---------|
| `/[tenant]/dashboard` | KPIs, quick actions, recent activity |
| `/[tenant]/purchases` | Record + list purchases |
| `/[tenant]/sales` | Record + list sales |
| `/[tenant]/inventory` | Stock by category |
| `/[tenant]/suppliers` | Supplier directory + balances |
| `/[tenant]/buyers` | Buyer directory + balances |
| `/[tenant]/categories` | Scrap types + default prices |

Implementation lives in `apps/web` (`globals.css`, `components/ui/*`, `tenant-shell.tsx`).

---

## 4. Mobile / POS app (future — M4+)

**Not built in current milestone.** Target UX:

### 4.1 Home

Large primary actions (min 48dp touch targets):

```
┌─────────────────────────┐
│  BUY IN    │   SELL OUT │
│  PAY       │   STOCK    │
└─────────────────────────┘
```

### 4.2 Bottom navigation

| Tab | Screen |
|-----|--------|
| Home | Action grid |
| Buy | Purchase flow |
| Sell | Sale flow (stock visible) |
| Pay | Supplier / buyer payment |
| More | History, settings |

Matches operational priority: intake → outflow → settlements.

### 4.3 Purchase / sale flow

1. Party search (phone/name) or quick-add  
2. **Category grid** — tiles with name + on-hand kg badge  
3. Numeric keypad: weight, price/kg (default from category)  
4. Payment: full / partial / credit  
5. Confirm → **print receipt** → success + “New transaction”

### 4.4 Stock

- Card per category: kg, avg cost, value estimate  
- Tap → movement timeline (read-only)  
- No direct balance edit on POS

### 4.5 Settings (grouped)

Inspired by mobile settings patterns:

- **Account** — PIN, sign out  
- **Yard** — receipt prefix, printer  
- **Sync** — offline queue count, last sync  
- **Support** — contact, version  

### 4.6 Receipt confirmation

Full-screen success: “Receipt printed” + reprint + next action.

---

## 5. Super Admin web (future — not scaffolded)

Concept dashboard for platform owner:

| Widget | Data |
|--------|------|
| Total tenants | Count all / active |
| Dealers | Active vs suspended |
| Monthly intake | Sum purchase kg per tenant (billing) |
| Billing | Overdue / trial / paid |
| Recent activity | Tenant created, suspension, large intake |
| System health | API, DB, M-Pesa webhook lag |

**Layout:** Same visual language as tenant web (light canvas, black KPI hero, card grid). Separate route prefix e.g. `/admin` with platform permissions only.

---

## 6. Accessibility & responsive

- Web sidebar stacks horizontally on mobile (nav wraps)  
- Tables scroll horizontally in `.table-wrap`  
- Focus rings on inputs (accent outline)  
- POS: high contrast for outdoor/sunlight (future)

---

## 7. What not to do

- Dark-only web theme (owner review needs readable reports)  
- Dense accounting-style grids on POS  
- Copying reference app branding, charts, or fake restaurant metrics  
- Building Super Admin or POS in web-only milestones

---

## 8. Milestone mapping

| Milestone | UI deliverable |
|-----------|----------------|
| M2 (current) | Tenant web polish + this doc |
| M4 | POS shell, bottom nav, buy/sell flows |
| M5 | Receipt preview / reprint UI |
| M6 | Billing widgets (owner + super admin) |
| M7 | Hardening, offline indicators |
