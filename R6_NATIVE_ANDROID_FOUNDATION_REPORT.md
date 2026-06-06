# YardFlow — R6 Native Android Foundation Report

**Milestone:** R6 — Native Android Mobile Foundation  
**Date:** 2026-06-06  
**Status:** Complete  
**Scope:** Android-first Expo/React Native app in `apps/pos`. No M-Pesa. No CS30 printing. No offline queue activation. Offline is handled safely (blocked on submit).

---

## 1. Summary

YardFlow now has a native Android app (`apps/pos`) built with **React Native + Expo SDK 56 + Expo Router + TypeScript**. It is the primary daily operational surface for scrap-yard cashiers on handheld devices including the CS30 POS.

The app implements all core operational flows — login, dashboard, buy (purchase), sell (sale), pay supplier, receive buyer payment, stock view, suppliers, buyers, categories, settings — against the **existing YardFlow API (R2–R4)**. No mobile-only business logic: the app submits and refetches. All ledger math, FIFO allocation, and balance integrity remain server-side.

---

## 2. Files Created

### `packages/theme`
Already existed (built in R5.8). Consumed as `@yardflow/theme`. No changes made.

### `apps/pos` — Config & Entry

| File | Purpose |
|------|---------|
| `package.json` | `@yardflow/pos` workspace package, Expo SDK 56 deps, `typecheck`/`start`/`android` scripts |
| `app.json` | Expo config — Android package `com.yardflow.pos`, scheme `yardflow`, brand green, `expo-router` + `expo-secure-store` plugins |
| `tsconfig.json` | Strict TS, extends `expo/tsconfig.base`, `@/*` alias → `./src/*` |
| `babel.config.js` | `babel-preset-expo` |
| `metro.config.js` | pnpm monorepo resolver — watches workspace root, resolves `packages/*` |
| `expo-env.d.ts` | Expo type reference |
| `.gitignore` | RN/Expo ignores |

### `apps/pos/app/` — Expo Router Routes (thin delegates)

| File | Route |
|------|-------|
| `_layout.tsx` | Root: `SafeAreaProvider` + `AuthProvider` + `NavigationGuard` (auth gate) + `Stack` |
| `index.tsx` | Entry redirect — auth → `/(tabs)`, else → `/login` |
| `login.tsx` | `/login` |
| `(tabs)/_layout.tsx` | Bottom tabs (Home, Buy, Sell, Pay, More) — Lucide icons, SDK-56 tab bar |
| `(tabs)/index.tsx` | Home tab |
| `(tabs)/buy.tsx` | Buy tab |
| `(tabs)/sell.tsx` | Sell tab |
| `(tabs)/pay.tsx` | Pay tab |
| `(tabs)/more.tsx` | More tab |
| `stock.tsx` | Stock stack screen (header shown) |
| `more/suppliers.tsx` | Suppliers stack screen |
| `more/buyers.tsx` | Buyers stack screen |
| `more/categories.tsx` | Categories stack screen |
| `more/settings.tsx` | Settings stack screen |

### `apps/pos/src/types/`

| File | Purpose |
|------|---------|
| `api.ts` | Response contracts: `UserProfile`, `LoginResponse`, `Category`, `InventoryItem`, `Supplier`, `Buyer`, `Purchase`, `Sale`, `SupplierPayment`, `BuyerPayment`, `BalanceSummary`, `PaymentAllocation` |

### `apps/pos/src/lib/`

| File | Purpose |
|------|---------|
| `api.ts` | `apiFetch<T>` — fetch client mirroring web; base URL from `EXPO_PUBLIC_API_URL` / `app.json extra.apiUrl` / `10.0.2.2:3001/v1`; `ApiError` class; 401 → `onUnauthorized` callback |
| `session.ts` | Token persistence: `expo-secure-store` for access/refresh tokens; `AsyncStorage` for user profile |
| `auth-context.tsx` | Session state, login/logout, `hasPermission`, startup `/auth/me` validation, 401 handler |
| `services.ts` | Typed wrappers over all API endpoints — no business logic, pure HTTP calls |
| `idempotency.ts` | `generateKey()` — UUID v4 for every mutation |
| `format.ts` | `formatMoney`, `formatWeight`, `formatDate`, `formatDayTime`, `formatMethod`, `isTodayEat`, `parseNumber` — display only, no calculation authority |
| `network.ts` | `useNetworkStatus()` — NetInfo subscription, `isConnected` + `isInternetReachable` |
| `offline-queue.ts` | `PendingMutation` structure, FIFO queue (AsyncStorage), `enqueue`/`list`/`count`/`clear`/`flushQueue` scaffold — **not activated in R6** |

### `apps/pos/src/components/ui/`

| Component | Description |
|-----------|-------------|
| `Text` | Typed variants (h1/h2/h3/body/bodySm/caption/kpi/kpiSm), muted/bold helpers, `StyleProp<TextStyle>` |
| `Button` | primary / secondary / danger / ghost, loading spinner, 48dp min height, `fullWidth` |
| `Card` | White surface card, `elevation`, sm/md/lg padding |
| `Badge` | Status chip: `paid` (green) / `partial` (amber) / `unpaid` (neutral) / `error` (red) |
| `Field` | Labeled text input with full border, error/hint text, suffix, numeric keyboard support |
| `SelectSheet` | Bottom-sheet modal picker with search input, quick-create affordance, selected highlight |
| `MethodPicker` | 4-chip grid: Cash / Bank / Mobile money (manual) / Other — no M-Pesa language |
| `Kpi` | KPI card with label/value/sublabel, 5 tones (default/green/blue/amber/featured) |
| `Screen` | `KeyboardAvoidingView` + `ScrollView` wrapper, safe area aware |
| `OfflineBanner` | Persistent red banner when `isConnected === false` |
| `Section` / `Row` | iOS-style grouped section list (Settings, More) |
| `LoadingView` / `EmptyState` / `ErrorNote` / `SuccessNote` / `InfoNote` | Feedback states |

### `apps/pos/src/screens/`

| Screen | Implementation |
|--------|---------------|
| `LoginScreen` | Yard code + email + password; `useAuth().login`; API error display |
| `HomeScreen` | Composes 6 API calls: balances + inventory + purchases + sales + payments; KPI grid (featured stock, intake, sales, owed, receivable); quick-action grid; recent activity list; pull-to-refresh |
| `BuyScreen` | Supplier select/quick-create → category select (price prefill) → kg → price → total display → paid-now → method picker → `POST /purchases`; idempotency key; 409 handling |
| `SellScreen` | Buyer select/quick-create → category + on-hand badge → kg → price → total → received → method → `POST /sales`; oversell surfaced from API 409 |
| `PayScreen` | Toggle Pay Supplier / Receive from Buyer; party select; balance KPI display; amount + method; `POST /supplier-payments` or `POST /buyer-payments`; allocation count in success; overpayment error verbatim from API |
| `StockScreen` | Inventory category cards sorted by weight; total kg + estimated value header; pull-to-refresh |
| `MoreScreen` | Navigation hub: Suppliers, Buyers, Categories, Stock, Settings, Sign out; user name/email/yard |
| `PartyListScreen` | Reusable for suppliers/buyers: search, balance display, credit indicator, pull-to-refresh |
| `CategoriesScreen` | 2-column category grid with buy/sell default prices per category |
| `SettingsScreen` | Account details, network status, pending queue count, app version, API endpoint, sign out |

---

## 3. Mobile Architecture

```
apps/pos
├─ app/                        Expo Router routes (thin: delegate to src/screens)
│  ├─ _layout.tsx              AuthProvider + SafeArea + NavigationGuard + Stack
│  ├─ index.tsx                Auth-aware redirect entry
│  ├─ login.tsx                Unauthenticated entry
│  ├─ (tabs)/                  Bottom-tab group
│  ├─ stock.tsx                Stack screen
│  └─ more/                    More sub-screens (stack)
└─ src/
   ├─ lib/                     api, auth-context, session, services, format, network, offline-queue, idempotency
   ├─ components/ui/           Themed thumb-friendly building blocks
   ├─ screens/                 Feature screens (logic lives here, routes are thin)
   └─ types/                   API response contracts

@yardflow/theme  ← sole source for all colors, spacing, typography tokens
@yardflow/validation ← available for shared Zod schemas
```

**Principles:**
- **API is the single source of truth.** Mobile submits, then refetches authoritative state. No local balance math.
- **Idempotency everywhere.** Every purchase/sale/payment carries a UUID `idempotencyKey`, making retries and future offline replay safe.
- **Tenant isolation.** Tenant scope comes from the JWT at login. The client never sends `tenantId` in request bodies.
- **Thin routes.** Route files only import and render screen components. All logic lives in `src/screens/`.
- **@yardflow/theme only.** No hex literals in component/screen files — all colors, spacing, and typography come from theme tokens.

---

## 4. Navigation Structure

Bottom tabs (Expo Router file-based `Tabs`, Lucide icons):

| Tab | Screen | Notes |
|-----|--------|-------|
| **Home** | Operational summary | Stock KPI, intake/sales today, owed/receivable, quick actions, recent activity |
| **Buy** | Purchase flow | Full-screen form — supplier + category + kg + price + paid + method |
| **Sell** | Sale flow | Shows available stock per category; server-enforced oversell |
| **Pay** | Payments | Toggle: Pay Supplier / Receive from Buyer |
| **More** | Hub | Suppliers, Buyers, Categories, Stock, Settings, sign out |

Stack screens layered over tabs: `Stock`, `Suppliers`, `Buyers`, `Categories`, `Settings`.

---

## 5. API Integration

Uses **only existing R2–R4 endpoints** — no mobile-only business logic:

| Flow | Endpoint(s) |
|------|-------------|
| Login / session validation | `POST /v1/auth/login`, `GET /v1/auth/me` |
| Dashboard | `GET /v1/balances/summary`, `/inventory`, `/purchases`, `/sales`, `/supplier-payments`, `/buyer-payments` |
| Buy | `POST /v1/purchases`, `GET /v1/suppliers`, `GET /v1/categories`, `POST /v1/suppliers` (quick-add) |
| Sell | `POST /v1/sales`, `GET /v1/buyers`, `GET /v1/categories`, `GET /v1/inventory`, `POST /v1/buyers` |
| Pay Supplier | `POST /v1/supplier-payments`, `GET /v1/suppliers`, `GET /v1/suppliers/:id` |
| Receive Buyer | `POST /v1/buyer-payments`, `GET /v1/buyers`, `GET /v1/buyers/:id` |
| Stock | `GET /v1/inventory` |
| Parties | `GET /v1/suppliers`, `GET /v1/buyers` |
| Categories | `GET /v1/categories` |

Base URL resolves from `EXPO_PUBLIC_API_URL` → `app.json extra.apiUrl` → `http://10.0.2.2:3001/v1` (Android emulator host alias). For a physical device on LAN, set `EXPO_PUBLIC_API_URL=http://<host-IP>:3001/v1`.

---

## 6. Payment Wiring

The app honors the R4 settlement engine and **never computes balances locally as truth**.

**Supplier payment:**
1. Mobile submits `POST /supplier-payments { supplierId, amountKes, paymentMethod, idempotencyKey }`.
2. API creates the append-only payment and runs FIFO allocation over oldest unpaid purchases.
3. `supplier.balanceKes` and purchase `payment_status` update server-side; overpayment → supplier credit.
4. Mobile **refetches** supplier detail to show new balance; success screen shows allocation count from API response.

**Buyer payment:**
1. Mobile submits `POST /buyer-payments { buyerId, amountKes, paymentMethod, idempotencyKey }`.
2. API FIFO-allocates to oldest unpaid sales; buyer overpayment **rejected by API** (422).
3. Mobile surfaces rejection error verbatim.

**Payment methods displayed:**
| Value | Display label |
|-------|--------------|
| `cash` | Cash |
| `bank` | Bank |
| `mobile_money_manual` | Mobile money (manual) |
| `other_manual` | Other |

**M-Pesa is not implied.** No STK Push, no B2C, no "Send M-Pesa" language anywhere in the app.

---

## 7. CS30 Readiness

R6 is CS30-conscious without implementing printing:

- **48dp minimum touch targets** on all interactive elements (Button `minHeight: 48`, Field `minHeight: 48`, SelectSheet options `paddingVertical: 14`)
- **Large action tiles** on Home (72dp height quick-action grid)
- **Simple single-column forms** optimized for one-hand handheld use
- **Numeric keyboard** on kg/price/amount fields
- **Portrait-only** orientation locked in `app.json`
- **Printing not implemented** — no `@expo/config-plugin` for Bluetooth ESC/POS, no receipt screen

---

## 8. Offline Scope

R6 prepares offline support but does not activate it:

**Implemented:**
- `useNetworkStatus()` — NetInfo subscription, `isConnected` state
- `OfflineBanner` — persistent red banner shown when offline
- `offline-queue.ts` — `PendingMutation` type, FIFO queue scaffold, `flushQueue` replay design
- `generateKey()` — idempotency keys make future offline replay safe

**Not activated:**
- Screens **block** operational submits (purchase/sale/payment) with a clear error when offline
- No auto-enqueueing of mutations
- No fake stock mutation
- No offline payment confirmation
- No offline receipt authority

**Future activation path:** When R8 enables offline queue, screens call `enqueue()` instead of blocking, and `flushQueue()` is called on reconnect. Each item reuses its stored idempotency key — duplicates are deduplicated server-side.

---

## 9. M-Pesa Explicitly Deferred

M-Pesa is **not implemented** in R6.

The current "mobile money" option (`mobile_money_manual`) means: the operator manually paid by M-Pesa outside the app and recorded the settlement here. No money moves automatically. No Daraja API calls. No STK Push. No B2C.

Real M-Pesa integration (Daraja STK + webhook confirmation + B2C disbursement) is planned for R8 or later, after the offline queue and receipt flows are complete.

---

## 10. Validation Results

| Check | Result |
|-------|--------|
| `pnpm --filter @yardflow/theme build` | ✅ tsc clean |
| `pnpm --filter @yardflow/pos typecheck` | ✅ tsc --noEmit clean (0 errors) |
| `pnpm --filter @yardflow/api test` | ✅ 54/54 (11 unit + 43 e2e) |
| `pnpm --filter @yardflow/web build` | ✅ 13 routes, clean build |

No API regressions. No web regressions. POS app type-checks clean.

---

## 11. Known Limitations

- **No on-device run verified** — app is typecheck-clean and architecturally sound; runtime smoke test requires an Android emulator or physical device with API accessible on LAN.
- **No deactivation UI on mobile** — parties/categories are create+view only; deactivation is owner/web per deletion rules.
- **No corrections/adjustments UI** — by design; owners use web.
- **Token refresh not implemented** — expired tokens drop the session to login; silent refresh deferred.
- **App icon/splash images** — color-configured in `app.json`; raster assets needed before store build.
- **No receipt printing** — deferred to R7 (CS30 Bluetooth ESC/POS Expo plugin).

---

## 12. Next Milestone Recommendation

**R7 — Receipts & CS30 Printing**

1. Receipt preview screen from saved ledger rows + reprint capability.
2. CS30 Bluetooth ESC/POS integration (Expo dev build / native config plugin).
3. Receipt type: purchase, sale, supplier payment, buyer payment.
4. Success screen after buy/sell/pay shows receipt preview + print button.

Then **R8 — M-Pesa + Offline Queue**:
- Daraja STK Push (buyer → cashier) + B2C (cashier → supplier)
- Async webhook confirmation in API
- Activate offline queue with replay on reconnect

Foundational pieces already in place: idempotency keys, `mobile_money_manual` method, offline queue scaffold.

---

## 13. Files Created / Modified

### Created
| File | Purpose |
|------|---------|
| `apps/pos/package.json` | `@yardflow/pos` workspace — Expo SDK 56 |
| `apps/pos/app.json` | Expo config, Android package, brand colors |
| `apps/pos/tsconfig.json` | Strict TS, `@/*` alias |
| `apps/pos/babel.config.js` | `babel-preset-expo` |
| `apps/pos/metro.config.js` | pnpm monorepo resolver |
| `apps/pos/expo-env.d.ts` | Expo type reference |
| `apps/pos/.gitignore` | RN/Expo ignores |
| `apps/pos/app/_layout.tsx` | Root layout with auth gate |
| `apps/pos/app/index.tsx` | Entry redirect |
| `apps/pos/app/login.tsx` | Login route |
| `apps/pos/app/stock.tsx` | Stock stack screen |
| `apps/pos/app/(tabs)/_layout.tsx` | Bottom tabs |
| `apps/pos/app/(tabs)/index.tsx` | Home tab |
| `apps/pos/app/(tabs)/buy.tsx` | Buy tab |
| `apps/pos/app/(tabs)/sell.tsx` | Sell tab |
| `apps/pos/app/(tabs)/pay.tsx` | Pay tab |
| `apps/pos/app/(tabs)/more.tsx` | More tab |
| `apps/pos/app/more/suppliers.tsx` | Suppliers stack |
| `apps/pos/app/more/buyers.tsx` | Buyers stack |
| `apps/pos/app/more/categories.tsx` | Categories stack |
| `apps/pos/app/more/settings.tsx` | Settings stack |
| `apps/pos/src/types/api.ts` | API response types |
| `apps/pos/src/lib/api.ts` | Fetch client, ApiError |
| `apps/pos/src/lib/session.ts` | SecureStore + AsyncStorage persistence |
| `apps/pos/src/lib/auth-context.tsx` | Auth state provider |
| `apps/pos/src/lib/services.ts` | Typed API service wrappers |
| `apps/pos/src/lib/idempotency.ts` | UUID v4 key generator |
| `apps/pos/src/lib/format.ts` | Display-only formatters |
| `apps/pos/src/lib/network.ts` | `useNetworkStatus` hook |
| `apps/pos/src/lib/offline-queue.ts` | Offline queue scaffold |
| `apps/pos/src/components/ui/Text.tsx` | |
| `apps/pos/src/components/ui/Button.tsx` | |
| `apps/pos/src/components/ui/Card.tsx` | |
| `apps/pos/src/components/ui/Badge.tsx` | |
| `apps/pos/src/components/ui/Field.tsx` | |
| `apps/pos/src/components/ui/SelectSheet.tsx` | |
| `apps/pos/src/components/ui/MethodPicker.tsx` | |
| `apps/pos/src/components/ui/Kpi.tsx` | |
| `apps/pos/src/components/ui/Screen.tsx` | |
| `apps/pos/src/components/ui/OfflineBanner.tsx` | |
| `apps/pos/src/components/ui/Section.tsx` | |
| `apps/pos/src/components/ui/Feedback.tsx` | |
| `apps/pos/src/components/ui/index.ts` | Barrel export |
| `apps/pos/src/screens/LoginScreen.tsx` | |
| `apps/pos/src/screens/HomeScreen.tsx` | |
| `apps/pos/src/screens/BuyScreen.tsx` | |
| `apps/pos/src/screens/SellScreen.tsx` | |
| `apps/pos/src/screens/PayScreen.tsx` | |
| `apps/pos/src/screens/StockScreen.tsx` | |
| `apps/pos/src/screens/MoreScreen.tsx` | |
| `apps/pos/src/screens/PartyListScreen.tsx` | |
| `apps/pos/src/screens/CategoriesScreen.tsx` | |
| `apps/pos/src/screens/SettingsScreen.tsx` | |
| `R6_NATIVE_ANDROID_FOUNDATION_REPORT.md` | This report |

### Modified
None — no existing files were modified.

---

*R6 complete. Native Android foundation operational. CS30-ready architecture. M-Pesa and printing safely deferred.*
