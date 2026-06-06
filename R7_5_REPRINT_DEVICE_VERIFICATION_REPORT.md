# R7.5 — Receipt Reprint & Device Verification

**Date:** 2026-06-06
**Branch:** main
**Status:** ✅ Complete — all validations passing

---

## 1. Reprint Implementation

### What was added

Receipt reprint is now wired into all screens that show saved transaction records.

| Location | Record type | Reprint available | Notes |
|----------|-------------|-------------------|-------|
| Home → Recent Activity (purchase row) | `Purchase` | ✅ Full receipt | Navigates to `/receipt-preview` |
| Home → Recent Activity (sale row) | `Sale` | ✅ Full receipt | Navigates to `/receipt-preview` |
| Supplier detail → Recent Payments | `RecentPaymentEntry` | ✅ Partial receipt | Missing allocation count (see §3) |
| Buyer detail → Recent Payments | `RecentPaymentEntry` | ✅ Partial receipt | Missing allocation count (see §3) |
| Supplier detail → Outstanding Purchases | `UnpaidPurchaseEntry` | ⚠️ Not available | Informative alert shown (see §3) |
| Buyer detail → Outstanding Sales | `UnpaidSaleEntry` | ⚠️ Not available | Informative alert shown (see §3) |

### How the Home screen reprint works

`HomeScreen` now stores the full `Purchase` / `Sale` API object in the `ActivityItem` union type. When a row is tapped, `buildPurchaseReceipt` or `buildSaleReceipt` is called immediately (no network round-trip needed) and the result is JSON-encoded into the `/receipt-preview` route params.

```
ActivityItem =
  | { kind: 'purchase'; record: Purchase; label; sub; value; date }
  | { kind: 'sale';     record: Sale;     label; sub; value; date }
```

---

## 2. Receipt Reconstruction Helpers

### Existing builders (already present before R7.5)

All four primary builders live in `apps/pos/src/printing/receipt.builder.ts`:

| Function | Input | Required fields used |
|----------|-------|----------------------|
| `buildPurchaseReceipt(p, cashierName, tenantSlug)` | `Purchase` | `id, supplier.name, category.name, weightKg, pricePerKgKes, totalValueKes, paidAmountKes, paymentMethod, paymentStatus, createdAt` |
| `buildSaleReceipt(s, cashierName, tenantSlug)` | `Sale` | `id, buyer.name, category.name, weightKg, pricePerKgKes, totalValueKes, paidAmountKes, paymentMethod, paymentStatus, createdAt` |
| `buildSupplierPaymentReceipt(pay, cashierName, tenantSlug)` | `SupplierPayment` | `id, supplier.name, amountKes, paymentMethod, allocations, creditAppliedKes, remainderToCreditKes, createdAt` |
| `buildBuyerPaymentReceipt(pay, cashierName, tenantSlug)` | `BuyerPayment` | `id, buyer.name, amountKes, paymentMethod, allocations, createdAt` |

### New partial builders (added in R7.5)

Two new helpers for `RecentPaymentEntry` (the slim shape returned by `/suppliers/:id` and `/buyers/:id`):

| Function | Input | What is missing vs full receipt |
|----------|-------|---------------------------------|
| `buildSupplierPaymentReceiptFromEntry(entry, supplierName, cashierName, tenantSlug)` | `RecentPaymentEntry` + parent supplier name | Allocation count (not in entry) |
| `buildBuyerPaymentReceiptFromEntry(entry, buyerName, cashierName, tenantSlug)` | `RecentPaymentEntry` + parent buyer name | Allocation count (not in entry) |

These produce a valid `ReceiptData` with an empty `lines[]`. The supplier/buyer name is taken from the parent detail screen context (already loaded), so no additional network call is needed.

---

## 3. API Gaps

### Outstanding purchase / sale entries — receipt not buildable

`UnpaidPurchaseEntry` and `UnpaidSaleEntry` (returned inside `GET /suppliers/:id` and `GET /buyers/:id`) contain only:

```
id, totalValueKes, remainingKes, paymentStatus, createdAt, category?
```

Fields missing that are required for a receipt:
- `weightKg` — needed for the weight line
- `pricePerKgKes` — needed for the unit price line
- `paidAmountKes` — needed for the paid/balance lines
- `paymentMethod` — needed for the method line
- `supplier` / `buyer` name — needed for party line (accessible from parent context, but moot without the others)

**Decision:** Show an informative `Alert` when these rows are tapped:
> "Full receipt details (weight, price, payment method) are not returned by the outstanding purchases endpoint. Open the purchase in transaction history to reprint."

No silent failure, no dead row.

**Fix path if needed:** The API could include these fields in the `unpaidPurchases` / `unpaidSales` arrays returned by `GET /suppliers/:id` / `GET /buyers/:id`. This is a backend schema extension, not a mobile change.

### `RecentPaymentEntry` — allocation count missing

`RecentPaymentEntry` has `id, amountKes, paymentMethod, createdAt`. The `allocations[]` array from the full `SupplierPayment` / `BuyerPayment` is not present. The partial builders set `lines: []`, so "Invoices cleared: N" is omitted. This is acceptable — the core payment amount and method are present.

---

## 4. Transaction Click Behaviour — Before vs After

| Element | R6.6 behaviour | R7.5 behaviour |
|---------|---------------|----------------|
| Home recent activity rows | Alert: "coming soon" | Navigate to `/receipt-preview` with full receipt |
| Supplier detail — outstanding purchases | Static `View` (not tappable) | `TouchableOpacity` → informative Alert |
| Supplier detail — recent payments | Static `View` (not tappable) | `TouchableOpacity` → navigate to `/receipt-preview` |
| Buyer detail — outstanding sales | Static `View` (not tappable) | `TouchableOpacity` → informative Alert |
| Buyer detail — recent payments | Static `View` (not tappable) | `TouchableOpacity` → navigate to `/receipt-preview` |

---

## 5. Files Changed

| File | Change |
|------|--------|
| `apps/pos/src/printing/receipt.builder.ts` | Added `buildSupplierPaymentReceiptFromEntry` and `buildBuyerPaymentReceiptFromEntry` for `RecentPaymentEntry` |
| `apps/pos/src/screens/HomeScreen.tsx` | `ActivityItem` changed to union type storing full `Purchase`/`Sale` record; `onPress` replaced Alert with `buildPurchaseReceipt`/`buildSaleReceipt` + receipt-preview navigation |
| `apps/pos/src/screens/SupplierDetailScreen.tsx` | Added `session` from `useAuth`; outstanding purchase rows → informative Alert; recent payment rows → `TouchableOpacity` + receipt-preview navigation |
| `apps/pos/src/screens/BuyerDetailScreen.tsx` | Same treatment as SupplierDetailScreen for buyer context |

---

## 6. Android Dev Build Verification

### Emulator command
```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3001/v1"
pnpm --filter @yardflow/pos exec expo run:android
```

### Physical device command (replace with actual LAN IP)
```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.x:3001/v1"
pnpm --filter @yardflow/pos exec expo run:android
```

**Status:** Build command documented. Physical dev build not executed in this session — requires Android SDK / connected device or running emulator. Expo Go was used for structural validation in prior sessions.

---

## 7. CS30 / Bluetooth Printer Verification

Physical CS30 print not verified in this session. No CS30 device or Bluetooth printer was available in the development environment.

### What IS confirmed structurally:
- `PrinterSettingsScreen` displays amber banner "Bluetooth is not available in Expo Go. Build a dev client to enable printing." when `isBluetoothAvailable()` returns `false`
- `printer.service.ts` uses lazy `try/require` for `react-native-bluetooth-classic` — no crash in Expo Go
- `usePrinter()` context is available from `PrinterProvider` in `_layout.tsx`
- `printReceipt(receipt: ReceiptData)` function is wired and ready
- All four receipt types produce valid `ReceiptData` that the ESC/POS formatter accepts

### Print pass/fail matrix

| Test | Status |
|------|--------|
| Expo Go Bluetooth banner | ✅ Confirmed (prior sessions) |
| Printer screen opens and stays open | ✅ Confirmed (R6.6) |
| Receipt preview renders from Buy success | ✅ Confirmed (R6.6) |
| Receipt preview renders from Sell success | ✅ Confirmed (R6.6) |
| Receipt preview renders from Pay success | ✅ Confirmed (R6.6) |
| Receipt preview renders from Home activity row | ✅ Implemented (R7.5) |
| Receipt preview renders from Supplier detail payments | ✅ Implemented (R7.5) |
| Receipt preview renders from Buyer detail payments | ✅ Implemented (R7.5) |
| Physical CS30 Bluetooth pair + test print | ⬜ Not tested — no device available |
| Physical CS30 print from Buy receipt | ⬜ Not tested |
| Physical CS30 print from Sell receipt | ⬜ Not tested |
| Physical CS30 print from Pay receipt | ⬜ Not tested |
| Physical CS30 reprint from Home row | ⬜ Not tested |

---

## 8. Validation Results

| Check | Result |
|-------|--------|
| `pnpm --filter @yardflow/pos typecheck` | ✅ No errors |
| `pnpm --filter @yardflow/api test` | ✅ 54 tests passed (11 unit, 43 e2e) |
| `pnpm --filter @yardflow/theme build` | ✅ Clean |
| `pnpm --filter @yardflow/web build` | ✅ 13 routes generated |

---

## 9. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| CS30 physical print not tested | Medium | All code is in place; test blocked by hardware availability |
| `UnpaidPurchaseEntry` / `UnpaidSaleEntry` missing receipt fields | Low | Informative alert shown; fix is a backend schema extension |
| `RecentPaymentEntry` missing allocation count | Low | Receipts still show amount + method; allocation detail not critical for reprint |
| Android dev build not run | Medium | Requires SDK/device; Expo Go confirms logic, dev build needed for Bluetooth |
| Token refresh (15m expiry) | Medium | No silent refresh — user re-logs after expiry |

---

## 10. Can R8 M-Pesa Start?

**Conditionally yes.** The receipt pipeline is complete end-to-end in code:

- All four transaction types build receipts
- Reprint from saved records works for purchases, sales, and payment records
- Receipt preview is reachable from every success flow and from the Home activity feed
- Printer screen stays open; Bluetooth unavailability is handled gracefully

**Blocking condition:** Physical CS30 Bluetooth print should be verified before R8 ships to production. M-Pesa transactions will also need receipt generation — the builders are ready for that (add `type: 'mpesa_payment'` or extend `buyer_payment`). R8 development can proceed in parallel with CS30 hardware testing.
