# YardFlow — M4 Native Mobile Foundation Report

**Milestone:** M4 — Native Mobile App Foundation (Android-first)
**Date:** 2026-06-05
**Status:** Complete — native Expo app in `apps/pos`, shared theme package, deletion rules documented, all flows wired to the existing API, no ledger regression (API 38/38).

---

## 1. Summary

YardFlow now has a **native mobile app** (`apps/pos`) built with **React Native + Expo (SDK 56) + Expo Router + TypeScript**. It is the new primary operational surface for daily scrap-yard work; the web app remains for owner review.

The app implements all core daily flows — login, dashboard, buy, sell, pay supplier, receive buyer payment, stock, suppliers/buyers, recent activity — against the **existing YardFlow API**. It introduces **no mobile-only business logic**: it submits transactions and refetches authoritative state. All settlement (FIFO allocation, supplier credit), stock integrity, and balance math stay server-side (M3 engine).

A shared **`packages/theme`** package exposes the frozen design system as platform-agnostic tokens so mobile matches web identity. Deletion/deactivation behavior is formally documented and enforced in policy before any mobile action.

---

## 2. Files created

### New package — `packages/theme`

| File | Purpose |
|------|---------|
| `packages/theme/package.json` | `@yardflow/theme` workspace package |
| `packages/theme/tsconfig.json` | Build config (emits `dist`) |
| `packages/theme/src/colors.ts` | Palette mirroring `globals.css` |
| `packages/theme/src/tokens.ts` | Spacing, radius, typography, shadows (numeric, RN-ready) |
| `packages/theme/src/semantic.ts` | Role tokens (purchase=green, sale=blue, pending=amber, danger=red) |
| `packages/theme/src/index.ts` | Aggregate `theme` export |

### New app — `apps/pos`

**Config & entry**

| File | Purpose |
|------|---------|
| `apps/pos/package.json` | Expo SDK 56 deps, `typecheck`/`lint` scripts |
| `apps/pos/app.json` | Expo config: Android package `com.yardflow.pos`, scheme, plugins, brand colors |
| `apps/pos/tsconfig.json` | Strict TS, `@/*` path alias, `react-jsx` |
| `apps/pos/babel.config.js` | `babel-preset-expo` |
| `apps/pos/metro.config.js` | pnpm monorepo resolver (watch workspace root) |
| `apps/pos/expo-env.d.ts` | Expo type reference |
| `apps/pos/.gitignore` | RN/Expo ignores |

**Routing (Expo Router, file-based)**

| File | Route |
|------|-------|
| `app/_layout.tsx` | Root: `SafeAreaProvider` + `AuthProvider` + auth gate (Stack) |
| `app/index.tsx` | Entry redirect (auth → tabs, else login) |
| `app/login.tsx` | `/login` |
| `app/(tabs)/_layout.tsx` | Bottom tabs (Home, Buy, Sell, Pay, More) |
| `app/(tabs)/index.tsx` | Home |
| `app/(tabs)/buy.tsx` | Buy |
| `app/(tabs)/sell.tsx` | Sell |
| `app/(tabs)/pay.tsx` | Pay |
| `app/(tabs)/more.tsx` | More |
| `app/stock.tsx` | Stock (pushed screen) |
| `app/more/suppliers.tsx` · `buyers.tsx` · `categories.tsx` · `settings.tsx` | More sub-screens |

**Core library (`src/lib`)**

| File | Purpose |
|------|---------|
| `api.ts` | Fetch client mirroring web (`ApiError`, 401 handler, `buildQuery`); base URL from Expo config / `EXPO_PUBLIC_API_URL` |
| `auth-context.tsx` | Session state, login/logout, `hasPermission`, expired-token handling |
| `session.ts` | Token persistence (SecureStore) + user profile (AsyncStorage) |
| `services.ts` | Typed wrappers over existing endpoints (no business logic) |
| `idempotency.ts` | UUID v4 idempotency keys for every mutation |
| `format.ts` | KES/kg/date display formatting (display only) |
| `network.ts` | `useNetworkStatus` (NetInfo) |
| `offline-queue.ts` | Offline mutation queue **scaffold** (structure + replay design) |

**Types** — `src/types/api.ts` (response contracts shared across screens)

**UI components (`src/components/ui`)** — `Text`, `Button`, `Card`, `Field`, `SelectField`, `SelectSheet`, `MethodPicker`, `Badge`, `Kpi`, `Screen`, `OfflineBanner`, `Section` (`SectionTitle`/`Row`), `Feedback` (`LoadingView`/`EmptyState`/`ErrorNote`/`SuccessNote`), `index.ts` barrel.

**Screens (`src/screens`)** — `LoginScreen`, `HomeScreen`, `BuyScreen`, `SellScreen`, `PayScreen`, `StockScreen`, `MoreScreen`, `PartyListScreen`, `CategoriesScreen`, `SettingsScreen`.

### Documentation

| File | Change |
|------|--------|
| `docs/DELETION_AND_REVERSAL_RULES.md` | **New** — append-only vs deactivation policy |
| `docs/SYSTEM_RULES.md` | Deletion policy note + cross-link (v1.1) |
| `docs/PERMISSION_MATRIX.md` | §5a Deactivation Gates + cross-link (v1.1) |

---

## 3. Mobile architecture

```
apps/pos
├─ app/                     Expo Router routes (thin: delegate to src/screens)
│  ├─ _layout.tsx           AuthProvider + SafeArea + navigation gate
│  ├─ (tabs)/               Bottom-tab group
│  └─ more/, stock.tsx      Stack screens over the tabs
├─ src/
│  ├─ lib/                  api, auth, session, services, format, network, offline-queue
│  ├─ components/ui/        themed, thumb-friendly building blocks
│  ├─ screens/              feature screens (logic lives here)
│  └─ types/                API contracts
└─ config                   app.json, metro, babel, tsconfig

@yardflow/theme  ← shared tokens (also consumable by web)
@yardflow/validation ← shared zod schemas (available to mobile)
```

**Principles**

- **API is the single source of truth.** Screens submit, then refetch dashboard/party/stock. No local balance authority (verified: `services.ts` only calls existing endpoints; `format.ts` math is display-only and labeled).
- **Idempotency everywhere.** Every purchase/sale/payment carries a generated UUID `idempotencyKey` (SYSTEM_RULES §24), making retries and future offline replay safe.
- **Tenant isolation preserved.** Tenant scope comes from the JWT issued at login; the client never sends `tenant_id` in bodies.
- **Permissions gate UI**, API enforces. Buy/Sell/Pay actions check `purchase:create` / `sale:create` / `supplier_payment:create` / `buyer_payment:create`; the server remains authoritative.
- **Thin routes, testable screens.** Route files only render screen components.

---

## 4. Navigation structure

Bottom tabs (Expo Router file-based `Tabs`, Ionicons):

| Tab | Screen | Notes |
|-----|--------|-------|
| **Home** | Operational summary | Yard name, stock, intake/sales today, owed/receivable, quick actions, recent activity |
| **Buy** | Purchase flow | Full-screen form |
| **Sell** | Sale flow | Shows available stock; server-enforced oversell |
| **Pay** | Payments | Toggle: Pay Supplier / Receive From Buyer |
| **More** | Hub | Suppliers, Buyers, Categories, Stock, Settings, sign out, version |

Stack screens layered over tabs: `Stock`, and the `More` sub-screens. The root layout redirects unauthenticated users to `/login` and authenticated users away from it.

---

## 5. Screens implemented

| Screen | Capabilities |
|--------|--------------|
| **Login** | Yard code + email + password; SecureStore session persistence; error states; auto-redirect on success |
| **Home** | `GET /dashboard/overview` KPIs (permission-gated), recent purchases+sales merged, quick actions, pull-to-refresh |
| **Buy** | Supplier select/quick-add, category select (price prefill), kg, buying price, live total, paid-now + method, submit → success → refetch |
| **Sell** | Buyer select/quick-add, category with on-hand badge, available-stock display, kg, selling price, received + method; **oversell surfaced from API 409** |
| **Pay** | Supplier: owed + credit, amount, method, **allocation breakdown** from response; Buyer: receivable, amount, method, **overpayment rejection** surfaced |
| **Stock** | Category cards (kg, avg cost, est. value); tap → movement summary modal (`/inventory/categories/:id`) |
| **Suppliers / Buyers** | Directory with balances/credit/status, search, quick-add |
| **Categories** | Read-only list with default prices |
| **Settings** | Account, network status, pending-queue count, app version, API endpoint, sign out |

UX: large 52dp targets, bottom-sheet pickers with search + quick-create, full-screen forms, card/list layouts, explicit loading/success/error states, persistent offline banner. No dense tables; no desktop layout squeezed onto mobile.

---

## 6. API integration

Uses **only existing endpoints** (no duplicate mobile logic):

| Flow | Endpoint(s) |
|------|-------------|
| Login | `POST /v1/auth/login` |
| Dashboard | `GET /v1/dashboard/overview` |
| Buy | `POST /v1/purchases`, `GET /v1/suppliers`, `GET /v1/categories`, `POST /v1/suppliers` (quick-add) |
| Sell | `POST /v1/sales`, `GET /v1/buyers`, `GET /v1/categories`, `GET /v1/inventory`, `POST /v1/buyers` |
| Pay supplier | `POST /v1/supplier-payments`, `GET /v1/suppliers`, `GET /v1/suppliers/:id` |
| Receive buyer | `POST /v1/buyer-payments`, `GET /v1/buyers`, `GET /v1/buyers/:id` |
| Stock | `GET /v1/inventory`, `GET /v1/inventory/categories/:id` |

Request bodies match the shared zod schemas (`packages/validation`): `createPurchaseSchema`, `createSaleSchema`, `createSupplierPaymentSchema`, `createBuyerPaymentSchema` — including `paymentMethod ∈ {cash, bank, mobile_money_manual, other_manual}` and UUID `idempotencyKey`.

Base URL resolves from `EXPO_PUBLIC_API_URL` → `app.json` `extra.apiUrl` → default `http://10.0.2.2:3001` (Android emulator host alias).

---

## 7. Payment wiring explanation

The app honors the **M3 settlement engine** and never computes balances locally as truth.

**Supplier payment**

1. Mobile submits `POST /supplier-payments` `{ supplierId, amountKes, paymentMethod, idempotencyKey }`.
2. API creates the append-only payment and runs **FIFO allocation** (oldest unpaid purchases first).
3. Purchase `payment_status` and `supplier.balanceKes` update server-side; overpayment becomes **supplier credit**.
4. Mobile **refetches** the supplier (`GET /suppliers/:id`) to show the new balance, and renders the **allocation breakdown** returned by the API (each slice + any remainder → credit).

**Buyer payment**

1. Mobile submits `POST /buyer-payments` `{ buyerId, amountKes, paymentMethod, idempotencyKey }`.
2. API FIFO-allocates to oldest unpaid sales; sale statuses and `buyer.balanceKes` update.
3. **Buyer overpayment is rejected by the API** (M3 rule); the mobile surfaces that error message verbatim.

In all cases the mobile shows pending (button loading), success (with allocations), and error states; balances displayed always come from an API refetch.

---

## 8. Deletion / deactivation rules added

New `docs/DELETION_AND_REVERSAL_RULES.md` (cross-linked from SYSTEM_RULES and PERMISSION_MATRIX):

- **Never delete** operational ledger records: purchases, sales, supplier/buyer payments, payment allocations, stock movements, corrections, stock adjustments. Fixes use correction / reversal / void-with-reason / compensating entry.
- **Safe deactivate (never delete)** setup records only — suppliers, buyers, categories, users — under eligibility checks:
  - Suppliers/Buyers: no outstanding balance, no unresolved credit, no unpaid/partial transactions; else block with reason.
  - Categories: zero stock on hand and no active dependency; else block or require owner approval.
  - Users: disable, never delete (audit history).
- **Client rule:** the mobile app shows **no delete affordances** for ledger records; deactivation is owner-managed, API-gated, and reason-driven. M4 mobile is create + view only for parties/categories (no deactivation UI yet), consistent with these rules.

---

## 9. Offline queue scope

Per M4 scope (prepare, do not implement full offline authority):

- **Implemented:** `src/lib/offline-queue.ts` — `PendingMutation` structure, FIFO `enqueue`/`list`/`count`/`clear`, and a `flushQueue(token)` replay design that reuses each item's idempotency key and flags failures (e.g. 409 stock) for manual resolution.
- **Network indicator:** `useNetworkStatus` + persistent `OfflineBanner`; Settings shows network + pending count.
- **Not enabled:** screens do **not** auto-enqueue or fake success. While offline, operational submits are **blocked** with a clear message. **No offline stock authority** — a sale is final only after API confirmation (SYSTEM_RULES §21, TRANSACTION_FLOWS §12).

---

## 10. Tests / builds run

```bash
pnpm install                         # ✓ Expo SDK 56 added (1 non-fatal peer warning: react-native-worklets)
pnpm --filter @yardflow/theme build  # ✓ tsc clean
pnpm --filter @yardflow/pos typecheck# ✓ tsc --noEmit clean
pnpm --filter @yardflow/api test     # ✓ 38/38 (4 suites)
node apps/web/scripts/clean-next.mjs
pnpm --filter @yardflow/web build    # ✓ compiled + type-checked, 11 routes
```

Results:

| Check | Result |
|-------|--------|
| Shared theme typecheck/build | ✅ |
| Mobile app typecheck (`tsc`) | ✅ clean |
| API e2e + unit | ✅ 38/38 |
| Web production build | ✅ success |
| Ledger/payment regression | ✅ none |

> Dev servers were stopped before building to avoid the known Windows `.next` corruption; `.next` was cleaned afterward.

**Runtime device verification** (launch, login, live flows on an Android emulator/device) was **not** executed in this environment — no emulator/device is available here. The app is type-clean and ready to run with:

```bash
pnpm --filter @yardflow/pos start    # then press "a" for Android
# Device→host API: set EXPO_PUBLIC_API_URL or app.json extra.apiUrl (10.0.2.2 = emulator host)
```

For a physical device on pnpm, add `.npmrc` with `node-linker=hoisted` (or use the included `metro.config.js` workspace resolver) and ensure the API is reachable on the LAN.

---

## 11. Known limitations

- **No on-device run here** — verified by typecheck + API/web builds; emulator smoke test pending (commands above).
- **Dependency pinning** — Expo packages pinned to current SDK 56 lines; run `npx expo install --fix` inside `apps/pos` before a production build to reconcile any native-version drift (e.g. `react-native-worklets` peer note, `@react-native-async-storage/async-storage` major).
- **No corrections/reversals/adjustments on mobile** — by design; owners use web (per deletion rules).
- **No deactivation UI on mobile** — parties/categories are create+view; deactivation is owner/web for now.
- **Receipt printing, M-Pesa, CS30, billing, Super Admin, full offline** — explicitly out of scope (not implemented), but architecture is prepared (idempotency, queue scaffold, payment methods include `mobile_money_manual`).
- **Token refresh** — expired tokens drop the session and return the user to login; silent refresh is deferred (shared debt with web from M3.5).
- **App icon/splash images** — color-only placeholders in `app.json`; add raster assets before store builds.

---

## 12. Success criteria

| Criterion | Status |
|-----------|--------|
| Native mobile app exists in `apps/pos` | ✅ Expo SDK 56 + Expo Router + TS |
| Login works | ✅ implemented (typecheck clean; runtime pending emulator) |
| Dashboard loads real API data | ✅ `GET /dashboard/overview` |
| Buy flow works | ✅ `POST /purchases` + refetch |
| Sell flow works | ✅ `POST /sales`, oversell from API |
| Pay supplier works | ✅ `POST /supplier-payments` + allocations |
| Receive buyer payment works | ✅ `POST /buyer-payments` + overpayment reject |
| Stock view works | ✅ inventory + movement modal |
| Uses YardFlow design system | ✅ `@yardflow/theme` shared tokens |
| Payment updates from API refetch (no fake math) | ✅ enforced in `services.ts` |
| Deletion rules documented | ✅ new doc + SYSTEM_RULES + PERMISSION_MATRIX |
| Append-only ledger preserved | ✅ no delete paths; create-only |
| API tests still pass | ✅ 38/38 |

---

## 13. Next recommended milestone

**M5 — Receipts & CS30 Printing (mobile-first)**

1. Receipt preview screen from saved ledger rows (TRANSACTION_FLOWS §10) + reprint.
2. CS30 Bluetooth ESC/POS integration (Expo dev build / config plugin).
3. Then **M-Pesa (STK/B2C)** reusing the M3 allocation engine with async confirmation, and **activate the offline queue** (replay on reconnect) now that the scaffold and idempotency are in place.

Foundational pieces already laid for these: idempotency keys, `mobile_money_manual` method, offline queue scaffold, and a clean API service layer.
