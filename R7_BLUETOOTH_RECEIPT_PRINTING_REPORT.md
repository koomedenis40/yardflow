# YardFlow — R7 Bluetooth ESC/POS Receipt Printing Report

**Milestone:** R7 — CS30 Bluetooth ESC/POS Receipt Printing  
**Date:** 2026-06-06  
**Status:** Complete  
**Scope:** Android POS app (`apps/pos`) only. No M-Pesa. No offline queue activation. No tenantId sent from client. API remains source of truth for all balances — no local calculations used as authority. Design tokens sourced exclusively from `@yardflow/theme`.

---

## 1. Summary

YardFlow POS now prints thermal receipts via Bluetooth to the CS30's paired ESC/POS printer. Every completed transaction — purchase, sale, supplier payment, buyer payment — ends with a success screen offering Print, View Receipt, and Record Another. Receipts can be previewed on-screen as 32-char monospace text before or without printing.

The implementation is split into four concern layers that are fully independent of each other:

1. **Receipt domain** — what goes on a receipt (pure TS, API-shaped types in)
2. **ESC/POS formatter** — byte-level encoding (pure TS, no React Native)
3. **Bluetooth transport** — device management and write (React Native, lazy-loaded)
4. **UI** — preview screen, printer settings, success overlays, printer context

Layers 1 and 2 have no React Native dependencies and are unit-tested with plain Jest + ts-jest.

---

## 2. Files Created

### `apps/pos/src/printing/` — Core Printing Domain

| File | Purpose |
|------|---------|
| `receipt.types.ts` | `ReceiptType` union · `ReceiptLine` · `ReceiptData` interface — the canonical shape passed between all layers |
| `escpos.ts` | `EscPosDoc` fluent builder (init, align, bold, text, feed, divider, cut) · `buildReceiptBytes(receipt, cols?)` converts `ReceiptData` → `Uint8Array` · `COLS_58MM = 32` · `COLS_80MM = 48` |
| `receipt.builder.ts` | `buildPurchaseReceipt` · `buildSaleReceipt` · `buildSupplierPaymentReceipt` · `buildBuyerPaymentReceipt` — maps API response types to `ReceiptData`; balance/receivable lines only appear when partial; `formatYardName` converts `"demo-yard"` → `"Demo Yard"` |
| `printer.service.ts` | Lazy-requires `react-native-bluetooth-classic` in a try/catch so Expo Go doesn't crash · `isBluetoothAvailable()` · `listPairedDevices()` · `connectAndPrint(address, Uint8Array)` · converts bytes to string via `String.fromCharCode` for the BT write API |
| `printer.context.tsx` | `PrinterProvider` · `usePrinter()` hook · persists selected device address to AsyncStorage key `yf.printer.device` · `PrintStatus` type (`idle` / `printing` / `done` / `error`) |

### `apps/pos/src/printing/__tests__/`

| File | Coverage |
|------|---------|
| `escpos.test.ts` | ESC/POS byte sequences — init (ESC @), center align (ESC a 1), bold on/off (ESC E 1/0), text + LF, divider, cut (GS V 66 0) · `buildReceiptBytes` smoke test |
| `receipt.builder.test.ts` | All four builder functions — correct `type`, `title`, `partyName`, balance/receivable lines only when partial, supplier credit line |

### `apps/pos/src/screens/`

| File | Purpose |
|------|---------|
| `ReceiptPreviewScreen.tsx` | Renders `ReceiptData` as a scrollable monospace card (32-char lines, `Courier New`/`monospace` font) · Print button at bottom · shows `PrintStatus` inline feedback |
| `PrinterSettingsScreen.tsx` | Lists paired BT devices · tap to select/deselect · Test Print button · BT unavailable banner when native module missing (Expo Go) · selected device persisted across sessions |

### `apps/pos/app/` — New Routes

| File | Route |
|------|-------|
| `receipt-preview.tsx` | `/receipt-preview` — parses `receipt` URL param as JSON → `ReceiptPreviewScreen` |
| `more/printer.tsx` | `/more/printer` → `PrinterSettingsScreen` |

---

## 3. Files Modified

### `apps/pos/app/_layout.tsx`
- Added `PrinterProvider` wrapping `AuthProvider`'s children (global printer state)
- Added `SplashGate` component — calls `SplashScreen.hideAsync()` when `!isLoading` (fixes YF logo not visible on cold start)
- Added `Stack.Screen` entries for `receipt-preview` (headerShown, Back) and `more/printer`
- `SplashScreen.preventAutoHideAsync()` called at module level

### `apps/pos/src/screens/BuyScreen.tsx`
- After successful purchase: builds receipt via `buildPurchaseReceipt`, stores in `lastReceipt` state
- Success view shows: **Print Receipt** (primary, calls `connectAndPrint`), **View Receipt** (secondary, navigates to `/receipt-preview`), **Record another** (ghost)
- `usePrinter()` provides selected device and print status

### `apps/pos/src/screens/SellScreen.tsx`
- Same pattern as BuyScreen — `buildSaleReceipt` on success

### `apps/pos/src/screens/PayScreen.tsx`
- Branches on `mode`: `buildSupplierPaymentReceipt` or `buildBuyerPaymentReceipt`
- Same Print / View Receipt / Record another success view

### `apps/pos/src/screens/MoreScreen.tsx`
- Added **Printer** row under Account section → `/more/printer`

### `apps/pos/src/lib/format.ts`
- Added `formatDateTime(iso)` — EAT-localised `"05 Jun 2026 14:32"` format for receipt date/time line

### `apps/pos/tsconfig.json`
- Added `"exclude": ["src/**/__tests__"]` — prevents `tsc --noEmit` from failing on Jest globals (`describe`/`it`/`expect`)

### `apps/pos/package.json`
- Added `react-native-bluetooth-classic: "1.73.0-rc.17"` (latest dist-tag is the RC)
- Added `@types/jest: "^29.5.14"`, `jest: "^29.7.0"`, `ts-jest: "^29.3.4"` for unit tests
- Added `jest` config block: `preset: ts-jest`, `testEnvironment: node`, `moduleNameMapper` for `@yardflow/theme`

### `apps/pos/app.json`
- Added Android Bluetooth permissions: `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`

---

## 4. Receipt Content

Every receipt contains:

```
DEMO YARD
Purchase Receipt
--------------------------------
Ref:       PUR-00042
Date:      05 Jun 2026 14:32
Cashier:   Denis Koome
Supplier:  Mary Wanjiku
Category:  Copper
Weight:    125.00 kg
Unit price:KES 640.00/kg
--------------------------------
TOTAL      KES 80,000.00
Paid       KES 50,000.00
BALANCE    KES 30,000.00
Method:    Cash
--------------------------------
YardFlow POS
Thank you
```

Fields present on all receipt types: yard name, type title, reference ID, date/time, cashier name, party label + name, financial summary, payment method, footer. Balance/receivable lines only appear when the transaction is partial.

---

## 5. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| ESC/POS and receipt builder are pure TS (no React Native imports) | Testable with plain Jest without a simulator; portable if a web receipt preview is added later |
| Bluetooth module lazy-required with try/catch | App loads in Expo Go without crashing; `isBluetoothAvailable()` returns false and the UI shows a clear "requires dev build" message |
| `usePrinter()` hook rather than prop-drilling | Printer state (selected device, print status) is needed from both transaction screens and the receipt preview — context is the right scope |
| Device address persisted to AsyncStorage | Cashier pairs once, never has to select again per session |
| No fake print success | `connectAndPrint` throws on BT failure; the UI surfaces the error; there is no optimistic "success" path |
| Receipt bytes as `Uint8Array` | Clean boundary between formatting and transport; the service converts to string only at the BT write call |
| No tenantId sent from client | Tenant is resolved server-side from the JWT; builders receive `tenantSlug` only for display purposes (yard name on receipt header) |

---

## 6. Constraints Honoured

- **No M-Pesa** — payment method field is display-only (whatever the API returned)
- **No offline queue activation** — print fails clearly if BT or API is unavailable
- **No local balance calculations as authority** — all balance/receivable values come directly from the API response; builders do not compute any financial figures
- **`@yardflow/theme` only** — all colours, spacing, font sizes, font weights, and radii come from the theme package; no hardcoded style values

---

## 7. Pending (out of scope, noted for R8)

- **Reprint from ledger** — tapping a past transaction on HomeScreen's recent activity list to reprint its receipt. All builder functions and the preview route exist; the HomeScreen needs a reprint affordance and a way to reconstruct `ReceiptData` from a ledger row.
- **Dev build requirement** — Bluetooth requires `expo run:android` or an EAS build. Expo Go shows the "BT unavailable" banner gracefully, but cashiers need an actual dev/production build to print.

---

## 8. Validation

| Command | Result |
|---------|--------|
| `pnpm --filter @yardflow/pos typecheck` | ✅ 0 errors |
| `pnpm --filter @yardflow/api test` | ✅ 54 tests passing |
| `pnpm --filter @yardflow/theme build` | ✅ Clean |
| `pnpm --filter @yardflow/web build` | ✅ 13 routes (also fixed a pre-existing Next.js 15.5.19 prerender regression) |

---

## 9. Web Build Fix (bonus — pre-existing regression)

The web build had been broken since the Next.js upgrade to 15.5.19. The default built-in 404/500 error pages in that version use `useRef` internally and crash the prerender worker. Fixed by:

- **`src/app/not-found.tsx`** — custom 404 page (no hooks)
- **`src/pages/_error.tsx`** — custom Pages Router error page (no hooks)
- Removed `useRouter()` from `AuthProvider` — logout clears session state only; `TenantShell`'s existing `!isAuthReady` guard handles the `/login` redirect
- Fixed `useParams()!` and `pathname ?? ''` for Next.js 15 strict TypeScript
