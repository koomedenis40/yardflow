# R7.7 — Mobile Debt Cleanup Before M-Pesa

## Scope
Short cleanup milestone to close pre-existing mobile UX debt before R8 M-Pesa work begins.
No new features, no M-Pesa, no Daraja, no offline queue activation.

---

## Changes

### 1. TransactionSuccess — Home always reachable (Task 1–4)

**File:** `apps/pos/src/components/ui/TransactionSuccess.tsx`

**Bugs fixed:**
- When `receipt` is null (no receipt data): the entire print/receipt/home block was inside `{receipt && (...)}`, so Back Home was invisible. Only "Record another" showed.
- When `receipt` is set but no printer is configured (`noPrinter`): the button row had Select Printer + View Receipt but no Back Home.

**Fix:**
- Added a full-width `Back Home` button in the `noPrinter` branch, below the Select Printer / View Receipt row.
- Added a conditional `Back Home` button rendered when `receipt === null`, placed just above "Record another".
- Added `homeBtnFull` style (surface background, border, same height as `halfBtn`, no `flex:1`).

**Result:** Home is now reachable in all three post-transaction states:
1. Printer configured → Back Home in button row ✅ (was already working)
2. No printer → Back Home below Select Printer / View Receipt ✅ (new)
3. No receipt data → Back Home above Record another ✅ (new)

---

### 2. SupplierDetailScreen — Remove dead click on outstanding purchases (Task 6)

**File:** `apps/pos/src/screens/SupplierDetailScreen.tsx`

**Bug fixed:** Outstanding purchase rows were wrapped in `TouchableOpacity` that fired `Alert.alert('Receipt unavailable', ...)`. This is a dead click — the data needed for a receipt is not returned by that endpoint.

**Fix:** Changed outstanding purchase rows from `TouchableOpacity` to `View`. Rows now display info (category, date, remaining/total) without tap affordance. Removed `Alert` import.

**Recent payment rows are unaffected** — those correctly open the receipt preview.

---

### 3. BuyerDetailScreen — Remove dead click on outstanding sales (Task 6)

**File:** `apps/pos/src/screens/BuyerDetailScreen.tsx`

**Same fix as SupplierDetailScreen:** Outstanding sale rows changed from `TouchableOpacity` to `View`. `Alert` import removed.

---

### 4. HomeScreen — KPI cards navigate (Task 6)

**File:** `apps/pos/src/screens/HomeScreen.tsx`

**Before:** KPI cards (INTAKE TODAY, SALES TODAY, SUPPLIER OWED, RECEIVABLE) were plain `<View>` with no tap handler.

**Fix:** Wrapped each with `TouchableOpacity`:
- INTAKE TODAY → `/(tabs)/buy`
- SALES TODAY → `/(tabs)/sell`
- SUPPLIER OWED → `/(tabs)/pay`
- RECEIVABLE → `/(tabs)/pay`

---

### 5. StockScreen — Category cards tappable (Task 7)

**File:** `apps/pos/src/screens/StockScreen.tsx`

**Before:** Category cards were plain `<View>` — informational only, no tap feedback.

**Fix:** Wrapped renderItem card in `TouchableOpacity`. Tap shows: "Category-level detail and drill-down is coming in the next release." No category detail screen exists yet; this will be replaced with navigation in R8.

---

### 6. PartyListScreen — Fix double top-padding (Task 8)

**File:** `apps/pos/src/screens/PartyListScreen.tsx`

**Bug:** Screen used `{ paddingTop: insets.top }` on its container, but both `more/suppliers` and `more/buyers` routes in `_layout.tsx` have `headerShown: true`. The native Stack header already accounts for the status bar inset; adding `paddingTop: insets.top` caused a double gap at the top.

**Fix:** Removed `useSafeAreaInsets` import, `const insets` declaration, and `{ paddingTop: insets.top }` from the container style.

---

### 7. CategoriesScreen — Fix double top-padding (Task 8)

**File:** `apps/pos/src/screens/CategoriesScreen.tsx`

**Same fix as PartyListScreen.** The `more/categories` route has `headerShown: true`; removed `useSafeAreaInsets` and the inline `paddingTop`.

---

## Audit — Clickable rows (Task 5–6)

| Screen | Row/Card | Status |
|---|---|---|
| Home | Activity rows | ✅ Opens receipt preview |
| Home | KPI cards | ✅ Navigate to relevant tab (fixed R7.7) |
| Home | Quick action buttons | ✅ Navigate to Buy/Sell/Pay/Stock |
| Stock | Category cards | ✅ "Coming in R8" on tap (fixed R7.7) |
| Suppliers list | Party rows | ✅ Navigate to SupplierDetail |
| Buyers list | Party rows | ✅ Navigate to BuyerDetail |
| SupplierDetail | Outstanding purchase rows | ✅ Non-tappable (fixed R7.7, was dead Alert) |
| SupplierDetail | Recent payment rows | ✅ Opens receipt preview |
| BuyerDetail | Outstanding sale rows | ✅ Non-tappable (fixed R7.7, was dead Alert) |
| BuyerDetail | Recent payment rows | ✅ Opens receipt preview |
| PayScreen | Payment history rows | ✅ Opens receipt preview |

---

## Web/Mobile API (Task 9)

- Both web (`apps/web`) and POS (`apps/pos`) call the same REST API at `/v1`.
- No mock or fallback data in either app. All screens load live from the API.
- POS API base: `http://10.0.2.2:3001/v1` for emulator; configurable in Settings → API endpoint for physical devices.
- Settings → Appearance shows "Dark mode: Coming soon" (Task 10 — intentionally deferred).

---

## Validation Results

| Check | Result |
|---|---|
| `pnpm --filter @yardflow/pos typecheck` | ✅ Exit 0 |
| `pnpm --filter @yardflow/api test` | ✅ 54 tests passed (11 unit + 43 e2e) |
| `pnpm --filter @yardflow/theme build` | ✅ Exit 0 |
| `pnpm --filter @yardflow/web build` | ✅ Exit 0 |

---

## Files Changed

- `apps/pos/src/components/ui/TransactionSuccess.tsx`
- `apps/pos/src/screens/SupplierDetailScreen.tsx`
- `apps/pos/src/screens/BuyerDetailScreen.tsx`
- `apps/pos/src/screens/HomeScreen.tsx`
- `apps/pos/src/screens/StockScreen.tsx`
- `apps/pos/src/screens/PartyListScreen.tsx`
- `apps/pos/src/screens/CategoriesScreen.tsx`

## Not Changed (Out of Scope)

- M-Pesa / Daraja / STK Push — R8
- Offline queue activation — deferred
- New ledger / payment logic — deferred
- Category detail screen — R8 (coming-soon note in place)
