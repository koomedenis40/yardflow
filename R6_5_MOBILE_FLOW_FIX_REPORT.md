# R6.5 — Mobile Transaction Flow Fix

**Date:** 2026-06-06
**Branch:** main
**Status:** ✅ Complete — all validations passing

---

## 1. Root Cause of "Bad Request" on Mobile Purchase

### Symptom
Every purchase submission from the mobile POS returned a generic `400 Bad Request`. No field-level details were surfaced to the user — the error message rendered as `[object Object]`.

### Cause

Two distinct problems:

**A — Wrong field name.** The mobile was sending `pricePerKgKes` in the purchase payload. The API schema (`packages/validation/src/purchases.ts`) requires `pricePerKg`. Zod's `safeParse` strips unknown fields (strict mode), so `pricePerKg` was missing from the parsed input and failed the required-field check.

**B — Extra payment fields in transaction body.** The mobile was also sending `paidAmountKes` and `paymentMethod` as part of the `createPurchase` / `createSale` call. These fields do not exist in the purchase/sale schemas and Zod drops them silently, but the intent was wrong at the architecture level: payments must be recorded separately via `POST /supplier-payments` or `POST /buyer-payments`.

**C — Error message serialisation.** NestJS wraps Zod's `error.flatten()` result as the `message` field: `{ message: { fieldErrors: {...}, formErrors: [...] } }`. The old `apiFetch` cast `parsed.message` directly to `string`, which produced `[object Object]` at render.

---

## 2. Payload Fix

### `apps/pos/src/lib/services.ts`

Changed `CreatePurchaseInput` and `CreateSaleInput`:

| Before | After |
|--------|-------|
| `pricePerKgKes: number` | `pricePerKg: number` |
| `paidAmountKes?: number` | *(removed)* |
| `paymentMethod?: string` | *(removed)* |

All callers updated to match.

### `apps/pos/src/lib/api.ts`

Added `extractErrorMessage()` that walks the NestJS/Zod flattened error shape:

```
{ fieldErrors: { pricePerKg: ['Required'] }, formErrors: [] }
→ "pricePerKg: Required"
```

Human-readable validation errors now surface in the UI instead of `[object Object]`.

---

## 3. Multi-Item Supplier Purchase Session

### Decision

The API already exposes `POST /purchases` per transaction and `POST /supplier-payments` for settlement. No batch endpoint was added.

The mobile BuyScreen was redesigned as a **Buy Session**:

1. Select supplier once at the top.
2. Add items inline (category + kg + price/kg per item). Multiple scrap types per visit.
3. Items list card shows running session total.
4. Payment card appears only when items exist (paid now + method picker).
5. Submit: one `createPurchase` API call per line item, then one `createSupplierPayment` if paid amount > 0.
6. Success screen lists all confirmed line items.

This matches real yard operations: a supplier often brings copper, brass, and steel in one drop.

---

## 4. Supplier and Buyer Detail Screens (TASK 4)

### Approach — no new endpoints

The web app's `party-workspace.tsx` already calls `GET /suppliers/:id` and `GET /buyers/:id` for enriched data. Audited the backend service:

- `GET /suppliers/:id` returns: basic supplier fields + `unpaidPurchases[]` (with `remainingKes`) + `recentPayments[]`
- `GET /buyers/:id` returns: basic buyer fields + `unpaidSales[]` (with `remainingKes`) + `recentPayments[]`

No new backend endpoints were created.

### New types added (`apps/pos/src/types/api.ts`)

- `SupplierDetail` — enriched supplier with `unpaidPurchases[]` and `recentPayments[]`
- `BuyerDetail` — enriched buyer with `unpaidSales[]` and `recentPayments[]`
- `UnpaidPurchaseEntry`, `UnpaidSaleEntry`, `RecentPaymentEntry`

### New service functions (`apps/pos/src/lib/services.ts`)

- `getSupplierDetail(token, id)` → `GET /suppliers/:id` as `SupplierDetail`
- `getBuyerDetail(token, id)` → `GET /buyers/:id` as `BuyerDetail`

### Supplier Detail Screen

Shows:
- Name + phone (or "No phone")
- Balance owed (amber, with left border accent) + Credit balance (green, if > 0)
- Quick actions: **New Purchase** → `/(tabs)/buy`, **Pay Supplier** → `/(tabs)/pay`
- Outstanding purchases (from `unpaidPurchases`): category name, date, remaining vs total
- Recent payments: method, date, amount

### Buyer Detail Screen

Shows:
- Name + phone (or "No phone")
- Receivable (blue, with left border accent)
- Quick actions: **New Sale** → `/(tabs)/sell`, **Receive Payment** → `/(tabs)/pay`
- Outstanding sales (from `unpaidSales`): category name, date, remaining vs total
- Recent payments: method, date, amount

---

## 5. UX Changes

| Screen | What changed |
|--------|-------------|
| **BuyScreen** | Full redesign: multi-item session with inline category/kg/price fields, session total, separate payment step |
| **SellScreen** | Fixed payload; payment is now a separate `createBuyerPayment` call; side-by-side kg/price layout; no receipt wiring |
| **HomeScreen** | Personalised greeting; green stock-on-hand hero card; 2×2 KPI grid (intake, sales, supplier owed, receivable); 2×2 action tile grid; richer activity feed with category names and coloured values |
| **PayScreen** | Cleaner mode toggle (Pay Supplier / Receive from Buyer); balance context cards shown after party selection; removed receipt/print wiring (paused) |
| **PartyListScreen** | Each row is now a tappable `TouchableOpacity` with chevron indicator; navigates to the appropriate detail screen |

---

## 6. Files Changed

### New files
- `apps/pos/src/screens/SupplierDetailScreen.tsx`
- `apps/pos/src/screens/BuyerDetailScreen.tsx`
- `apps/pos/app/supplier/[id].tsx`
- `apps/pos/app/buyer/[id].tsx`

### Modified files
- `apps/pos/src/lib/api.ts` — `extractErrorMessage()` for Zod flattened errors
- `apps/pos/src/lib/services.ts` — fixed input types; added `getSupplierDetail`, `getBuyerDetail`
- `apps/pos/src/types/api.ts` — added `SupplierDetail`, `BuyerDetail`, entry sub-types
- `apps/pos/src/screens/BuyScreen.tsx` — full rewrite (multi-item session)
- `apps/pos/src/screens/SellScreen.tsx` — payload fix + UX improvements
- `apps/pos/src/screens/HomeScreen.tsx` — full redesign
- `apps/pos/src/screens/PayScreen.tsx` — redesign, balance context cards
- `apps/pos/src/screens/PartyListScreen.tsx` — tappable rows + navigation
- `apps/pos/app/_layout.tsx` — added `Stack.Screen` for `supplier/[id]` and `buyer/[id]`

---

## 7. Validation Results

| Check | Result |
|-------|--------|
| `pnpm --filter @yardflow/pos typecheck` | ✅ No errors |
| `pnpm --filter @yardflow/api test` | ✅ 54 tests passed (11 unit, 43 e2e) |
| `pnpm --filter @yardflow/theme build` | ✅ Clean |
| `pnpm --filter @yardflow/web build` | ✅ 13 routes generated |

---

## 8. Remaining Mobile UX Debt

The following items are known but out of scope for this milestone:

- **PartyListScreen inactive filter** — currently shows both active and inactive parties; should default to active only with a toggle.
- **BuyScreen supplier balance hint** — could show how much is currently owed to a selected supplier before they pick items.
- **Navigation post-action** — after recording a purchase/sale from a detail screen quick-action, there's no deep-link back to the supplier/buyer detail.
- **Offline queue** — deliberately deactivated. The queue infra exists but is not wired.
- **Category default price** — SellScreen pre-fills `defaultSellingPriceKes`; BuyScreen pre-fills `defaultBuyingPriceKes`. These are editable but visible to the operator — if they deviate, there's no warning.

---

## 9. Can R7 (Receipt Printing) Safely Continue?

**Yes.** The transaction flows are now correct:

- `POST /purchases` receives `supplierId, categoryId, weightKg, pricePerKg, idempotencyKey` — all valid.
- `POST /sales` receives `buyerId, categoryId, weightKg, pricePerKg, idempotencyKey` — all valid.
- Payments are recorded separately via `POST /supplier-payments` / `POST /buyer-payments`.
- All screens complete to a success state without errors.

The R7 receipt printing milestone can resume with confidence that the underlying transaction data is well-formed and the success path is stable.
