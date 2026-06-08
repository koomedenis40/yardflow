# R8.1 — M-Pesa Foundation

**Milestone:** R8.1 — M-Pesa Foundation  
**Date:** 2026-06-08  
**Status:** Complete  
**Base:** R7.8 (`e9eb865`)  
**Scope:** Database foundation, Daraja OAuth, STK Push initiation, intent status endpoint, log-only callback endpoint. No payment creation. No balance updates. No receipts.

---

## 1. Summary

This milestone creates the complete M-Pesa infrastructure in the YardFlow API. It implements the database schema, Daraja authentication, STK Push request flow, and a log-only callback endpoint. All balance-change logic, payment creation, and receipt generation are explicitly deferred to R8.2+.

---

## 2. Files Created / Updated

### Schema

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Added 4 enums, extended PaymentMethod enum, added 3 models, added relations |
| `apps/api/prisma/migrations/20260608161505_r8_1_mpesa_foundation/migration.sql` | Generated migration |

### API Module

| File | Purpose |
|------|---------|
| `apps/api/src/mpesa/mpesa.module.ts` | NestJS module wiring |
| `apps/api/src/mpesa/controllers/mpesa.controller.ts` | 3 endpoints |
| `apps/api/src/mpesa/services/daraja-auth.service.ts` | OAuth token + in-process cache |
| `apps/api/src/mpesa/services/daraja-stk.service.ts` | STK Push request, password generation |
| `apps/api/src/mpesa/services/mpesa-payment-intent.service.ts` | Intent lifecycle orchestration |
| `apps/api/src/mpesa/dto/stk-push.dto.ts` | Zod-validated request DTO |
| `apps/api/src/mpesa/types/daraja.types.ts` | Daraja request/response type definitions |
| `apps/api/src/mpesa/utils/phone.utils.ts` | Phone normalization + Safaricom format |

### Configuration

| File | Change |
|------|--------|
| `apps/api/src/config/env.schema.ts` | Added 13 Daraja env vars with optional defaults |
| `apps/api/src/app.module.ts` | Registered MpesaModule |

### Tests

| File | Tests |
|------|-------|
| `apps/api/test/mpesa.unit.spec.ts` | 21 unit tests (15 spec-required + 6 additional edge cases) |

---

## 3. Database Schema

### New Enums

```
MpesaDirection:    collection | disbursement
MpesaChannel:      stk_push | b2c
MpesaIntentStatus: pending | accepted | success | failed | cancelled | timeout | reversed
MpesaEnvironment:  sandbox | production
```

### PaymentMethod Extended

```
mpesa_stk  — STK Push collection from buyer
mpesa_b2c  — B2C payout to supplier (R8.4+)
```

### New Models

**`tenant_mpesa_configs`** — per-tenant Daraja credentials (shortcode, passkey, consumer key/secret, callback URL, B2C fields). One row per tenant, `UNIQUE(tenant_id)`.

**`mpesa_payment_intents`** — append-only intent ledger. Fields: direction, channel, amount, phone, status, idempotency key, Daraja identifiers (checkoutRequestId, merchantRequestId, mpesaReceiptNumber), buyer/supplier FKs, timestamps.  
Indexes: `(tenantId, idempotencyKey)` UNIQUE, `(tenantId, status)`, `(checkoutRequestId)`, `(tenantId, buyerId)`, `(tenantId, createdAt DESC)`.

**`mpesa_callback_logs`** — raw Daraja callback storage. Fields: tenantId (nullable — resolved from DB by checkoutRequestId, never from client), checkoutRequestId, rawPayload (JSON), processedAt.

---

## 4. Endpoints

### `POST /v1/mpesa/stk-push`
- **Auth:** JWT + TenantMembershipGuard + `buyer_payment:create`
- **Body:** `{ buyerId, amountKes, phone, idempotencyKey, accountReference?, transactionDesc? }`
- **Flow:** validate buyer → ceil/overpayment check → normalize phone → create `pending` intent → send STK Push → update to `accepted`
- **Returns:** `{ intentId, status, checkoutRequestId }`
- **Idempotent:** duplicate `idempotencyKey` returns existing intent

### `GET /v1/mpesa/intents/:id/status`
- **Auth:** JWT + TenantMembershipGuard + `payment:view`
- **Returns:** `{ intentId, status, amountKes, phoneNumber, checkoutRequestId, mpesaReceiptNumber, createdAt, updatedAt }`
- **Tenant isolation:** query scoped to `tenantId` from JWT

### `POST /v1/mpesa/stk-callback`
- **Auth:** None (`@Public()` — Daraja cannot send JWT)
- **Action (R8.1 only):** log raw payload to `mpesa_callback_logs`, return HTTP 200
- **Security:** `tenantId` derived from `checkoutRequestId` via DB lookup — never trusted from payload
- **Does NOT:** create payments, update balances, generate receipts

---

## 5. Business Rules Enforced

| Rule | Enforcement |
|------|-------------|
| No overpayment | `Math.ceil(amount) > Math.floor(balance)` → 422 |
| Zero balance | Buyer balance ≤ 0 → 422 |
| Phone normalization | `07X→+254X`, `254X→+254X`, `+254X→unchanged`; invalid → 400 |
| Idempotency | `UNIQUE(tenantId, idempotencyKey)` + duplicate key returns original |
| Tenant isolation | All queries scoped to `user.tenantId!` from JWT |
| Intent failure | STK Push error → intent marked `failed`, 422 returned |
| Callback safety | `tenantId` resolved from DB, not from Daraja payload |

---

## 6. Security Properties

| Property | Implementation |
|----------|---------------|
| Daraja credentials server-side only | `ConfigService` reads from env; never exposed to client |
| Token logging | Only `"token_fetched"` or `"token_from_cache"` logged — never the token value |
| Secrets not committed | `.env.example` uses placeholders only |
| Callback `tenantId` source | Always from `mpesa_payment_intents.tenant_id` via `checkoutRequestId` lookup |
| Callback effect (R8.1) | Log-only — zero payment/balance/receipt side effects |

---

## 7. What R8.1 Does NOT Do

| Action | Status |
|--------|--------|
| STK callback processing into payment | ❌ Deferred to R8.2 |
| Reconciliation / STK Query | ❌ Deferred |
| `BuyerPayment` or `SupplierPayment` creation | ❌ Deferred |
| FIFO allocation from M-Pesa | ❌ Deferred |
| Balance updates from M-Pesa | ❌ Deferred |
| Receipt generation from M-Pesa | ❌ Deferred |
| B2C payout flow | ❌ Deferred to R8.4+ |
| Mobile UI changes | ❌ Deferred |
| Web UI changes | ❌ Deferred |

---

## 8. Validation

| Check | Result |
|-------|--------|
| `pnpm --filter @yardflow/api test` | ✅ 74 tests passed (31 unit + 43 e2e) |
| `pnpm --filter @yardflow/pos typecheck` | ✅ Exit 0 |
| `pnpm --filter @yardflow/theme build` | ✅ Exit 0 |
| `pnpm --filter @yardflow/web build` | ✅ Exit 0 |
| `pnpm -r build` | ✅ All packages built |
| Prisma migration applied | ✅ `20260608161505_r8_1_mpesa_foundation` |
