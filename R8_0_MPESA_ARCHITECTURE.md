# R8.0 — M-Pesa Architecture & Reconciliation Design

**Milestone:** R8.0 — Architecture and Schema Design  
**Date:** 2026-06-08  
**Status:** Design complete — no code activated  
**Base:** R7.7 (`dbe2e1a`)

---

## 1. Architecture Overview

M-Pesa is integrated as an **asynchronous payment channel** that feeds the existing R4 payment engine. Daraja is never trusted directly; every M-Pesa confirmation routes through the existing `BuyerPaymentsService` or `SupplierPaymentsService` before any balance changes.

```
Cashier/Owner (mobile or web)
    │
    ▼
POST /v1/mpesa/stk-push  ←── buyer collection intent
    │
    ├─ Create MpesaPaymentIntent (pending)
    ├─ Get Daraja OAuth token (cached)
    ├─ Send STK Push request → Daraja returns CheckoutRequestID + MerchantRequestID
    ├─ Update intent status = accepted
    └─ Return { intentId, status: 'accepted' }

UI polls GET /v1/mpesa/intents/:id/status
    └─ "Waiting for customer M-Pesa PIN"

Daraja callback → POST /v1/mpesa/stk-callback  (public, no auth)
    │
    ├─ INSERT MpesaCallbackLog (raw payload always stored first)
    ├─ Lookup intent by CheckoutRequestID
    ├─ [TX] SELECT MpesaPaymentIntent FOR UPDATE
    │       IF status already 'success' → COMMIT (idempotent)
    ├─ ResultCode = 0 (success):
    │   ├─ UPDATE intent status = success
    │   ├─ Call BuyerPaymentsService.create(...)  ← R4 engine
    │   │     └─ PaymentAllocationService FIFO runs
    │   ├─ Store confirmedPaymentId on intent
    │   └─ Generate receipt
    └─ ResultCode ≠ 0 (failure/cancel):
        └─ UPDATE intent status = failed | cancelled
           (no balance change)
```

**Non-negotiable rule:** Daraja callbacks never update `buyers.balance_kes` or `suppliers.balance_kes` directly. All balance mutations happen through the existing R4 payment services only.

---

## 2. Payment Types

### 2.1 Buyer Collection via STK Push (R8 target)

- Buyer pays yard through Safaricom Paybill.
- Cashier or owner initiates STK Push from Pay screen.
- Customer receives prompt on phone, enters M-Pesa PIN.
- On confirmation: creates `BuyerPayment` through R4 engine → FIFO allocation → balance update.

### 2.2 Supplier Payout via B2C (design only, activate in R8.4+)

- Yard pays supplier directly to their M-Pesa number.
- Owner initiates B2C disbursement.
- On confirmation: creates `SupplierPayment` through R4 engine → FIFO allocation → balance update.
- Requires B2C shortcode, initiator credentials, security credential.

---

## 3. Database Schema

> **Note:** `DATABASE_CONTRACTS.md §7` sketched `mpesa_transactions` as a single table. R8.0 supersedes that design with three dedicated tables that cleanly separate intent lifecycle, callback audit, and credential management. The `mpesa_transactions` sketch should be replaced by `mpesa_payment_intents` + `mpesa_callback_logs` + `tenant_mpesa_configs` when the migration is written.

### 3.1 `mpesa_payment_intents`

Primary table tracking the lifecycle of every M-Pesa payment attempt.

```sql
CREATE TABLE mpesa_payment_intents (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),

  -- What kind of operation
  direction                 mpesa_direction NOT NULL,      -- collection | disbursement
  channel                   mpesa_channel NOT NULL,        -- stk_push | b2c

  -- Lifecycle
  status                    mpesa_intent_status NOT NULL DEFAULT 'pending',

  -- Parties (exactly one must be set per direction)
  buyer_id                  UUID REFERENCES buyers(id),
  supplier_id               UUID REFERENCES suppliers(id),

  -- Payment details
  amount_kes                NUMERIC(14,2) NOT NULL CHECK (amount_kes > 0),
  phone_number              TEXT NOT NULL,               -- normalized +254...
  account_reference         TEXT NOT NULL,               -- Paybill account field
  transaction_desc          TEXT NOT NULL,

  -- Daraja STK Push identifiers (set on accepted)
  checkout_request_id       TEXT UNIQUE,
  merchant_request_id       TEXT,

  -- Daraja B2C identifiers (set on send)
  originator_conversation_id TEXT UNIQUE,
  conversation_id           TEXT,

  -- Daraja confirmation data (set on success)
  mpesa_receipt_number      TEXT UNIQUE,
  result_code               INT,
  result_desc               TEXT,
  transaction_date          TIMESTAMPTZ,

  -- Link to confirmed payment in R4 engine
  confirmed_payment_id      UUID,                        -- buyer_payments.id or supplier_payments.id

  -- Audit
  idempotency_key           TEXT NOT NULL,
  requested_by              UUID NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at              TIMESTAMPTZ,

  CONSTRAINT uq_intent_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT chk_party CHECK (
    (direction = 'collection' AND buyer_id IS NOT NULL AND supplier_id IS NULL) OR
    (direction = 'disbursement' AND supplier_id IS NOT NULL AND buyer_id IS NULL)
  )
);

CREATE TYPE mpesa_direction AS ENUM ('collection', 'disbursement');
CREATE TYPE mpesa_channel AS ENUM ('stk_push', 'b2c');
CREATE TYPE mpesa_intent_status AS ENUM (
  'pending',    -- intent created, STK/B2C request being sent
  'accepted',   -- Daraja acknowledged (CheckoutRequestID received)
  'success',    -- callback ResultCode=0, payment confirmed
  'failed',     -- callback ResultCode≠0
  'cancelled',  -- user cancelled on phone (ResultCode=1032)
  'timeout',    -- no callback within threshold, or B2C QueueTimeout
  'reversed'    -- confirmed then reversed (append-only reversal record)
);

CREATE INDEX idx_mpesa_intents_tenant ON mpesa_payment_intents (tenant_id, created_at DESC);
CREATE INDEX idx_mpesa_intents_checkout ON mpesa_payment_intents (checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE INDEX idx_mpesa_intents_buyer ON mpesa_payment_intents (tenant_id, buyer_id) WHERE buyer_id IS NOT NULL;
CREATE INDEX idx_mpesa_intents_supplier ON mpesa_payment_intents (tenant_id, supplier_id) WHERE supplier_id IS NOT NULL;
CREATE UNIQUE INDEX idx_mpesa_receipt_unique ON mpesa_payment_intents (mpesa_receipt_number) WHERE mpesa_receipt_number IS NOT NULL;
```

**Status transition rules:**

```
pending → accepted → success
                   → failed
                   → cancelled
         → failed  (if Daraja rejects STK request itself)
accepted → timeout (reconciliation job)
success  → reversed (separate reversal record — intent row not mutated)
```

`pending` → `accepted` happens synchronously when Daraja responds to the STK Push request.  
`accepted` → `success|failed|cancelled` happens asynchronously via callback.  
`accepted` → `timeout` happens via reconciliation job after threshold (default: 5 minutes).

---

### 3.2 `mpesa_callback_logs`

Raw callback audit — always written first, before any processing. Used for debugging, reconciliation, and replay.

```sql
CREATE TABLE mpesa_callback_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id           UUID REFERENCES mpesa_payment_intents(id),  -- nullable: matched after lookup
  tenant_id           UUID REFERENCES tenants(id),                -- nullable: derived from intent
  callback_type       mpesa_callback_type NOT NULL,
  external_reference  TEXT NOT NULL,             -- CheckoutRequestID or OriginatorConversationID
  raw_payload         JSONB NOT NULL,            -- verbatim Daraja JSON
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  processing_status   TEXT NOT NULL DEFAULT 'pending',   -- pending | success | failed | ignored
  error_message       TEXT
);

CREATE TYPE mpesa_callback_type AS ENUM (
  'stk_callback',
  'b2c_result',
  'b2c_timeout',
  'transaction_status_result'
);

CREATE INDEX idx_callback_logs_intent ON mpesa_callback_logs (intent_id);
CREATE INDEX idx_callback_logs_ref ON mpesa_callback_logs (external_reference);
CREATE INDEX idx_callback_logs_received ON mpesa_callback_logs (received_at DESC);
```

**Rule:** `raw_payload` is written in its own database write (outside the intent-processing transaction) so that raw callbacks survive even if processing fails. No callback is ever lost.

---

### 3.3 `tenant_mpesa_configs`

Per-tenant Daraja credentials. MVP: single environment row per tenant (sandbox). Production adds separate row.

```sql
CREATE TABLE tenant_mpesa_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  environment           mpesa_environment NOT NULL DEFAULT 'sandbox',

  -- Paybill setup
  shortcode             TEXT NOT NULL,         -- Paybill number (e.g. 174379 for sandbox)
  shortcode_type        TEXT NOT NULL DEFAULT 'paybill',  -- paybill | till
  passkey               TEXT NOT NULL,         -- ENCRYPTED at rest (AES-256-GCM)

  -- OAuth credentials
  consumer_key          TEXT NOT NULL,         -- ENCRYPTED
  consumer_secret       TEXT NOT NULL,         -- ENCRYPTED

  -- B2C setup (nullable until B2C implemented)
  b2c_shortcode         TEXT,
  initiator_name        TEXT,
  security_credential   TEXT,                 -- ENCRYPTED, optional

  -- Routing
  callback_base_url     TEXT NOT NULL,         -- e.g. https://api.yardflow.app/v1

  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_tenant_env UNIQUE (tenant_id, environment)
);

CREATE TYPE mpesa_environment AS ENUM ('sandbox', 'production');
```

**MVP decision:** For sandbox phase, load credentials from environment variables (see §6). The `tenant_mpesa_configs` table is designed and migrated now but remains empty until per-tenant onboarding is needed. The `MpesaService` reads from env vars with a fallback to the config table.

**Encryption note:** `passkey`, `consumer_key`, `consumer_secret`, `security_credential` must be encrypted at rest using AES-256-GCM with a key from `ENCRYPTION_KEY` env var before being stored. Plaintext values must never appear in the database. This is not implemented in R8.0 but must be implemented in R8.1 before any production credentials are stored.

---

## 4. State Machine

```
                    ┌─────────────────────────────────┐
                    │                                 │
   initiateStk()    │                    timeout job  │
  ─────────────→  pending ──────────→ accepted ──────→ timeout
                    │                    │
                    │ Daraja error       │  callback arrives
                    ↓                   ↓
                  failed          ResultCode = 0?
                                  ┌───┴──────────┐
                                  │              │
                                  ↓              ↓
                               success         failed
                                               cancelled (1032)
                  ↑
                  └── reversed (new append-only record, not status mutation)
```

**Idempotency guarantee:** If `status = success` when callback arrives again (duplicate), the processing transaction detects this via `FOR UPDATE` + status check and returns 200 without creating a second payment. The duplicate callback is still logged in `mpesa_callback_logs` with `processing_status = 'ignored'`.

---

## 5. STK Push Buyer Collection Flow

### 5.1 Request Phase

```
POST /v1/mpesa/stk-push
Authorization: Bearer <jwt>
Body: {
  buyerId: string,
  amountKes: number,
  phoneNumber: string,       // +254... normalized
  accountReference: string,  // buyer name or invoice ref
  transactionDesc: string,
  idempotencyKey: string
}

1. Validate: buyer exists in tenant, amount > 0, phone valid (+254 format)
2. Check: no active pending/accepted intent for same buyer + amount + idempotencyKey
3. INSERT mpesa_payment_intents (status=pending)
4. Get Daraja OAuth token (cached, see §5.3)
5. Generate STK password:
     timestamp = format(now(), 'YYYYMMDDHHmmss')  // Africa/Nairobi
     password  = base64(shortcode + passkey + timestamp)
6. POST https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
   {
     BusinessShortCode: config.shortcode,
     Password:          password,
     Timestamp:         timestamp,
     TransactionType:   "CustomerPayBillOnline",
     Amount:            Math.ceil(amountKes),   // Daraja requires integer
     PartyA:            phoneNumber,
     PartyB:            config.shortcode,
     PhoneNumber:       phoneNumber,
     CallBackURL:       config.callbackBaseUrl + "/mpesa/stk-callback",
     AccountReference:  accountReference,        // max 12 chars
     TransactionDesc:   transactionDesc          // max 13 chars
   }
7. On 200 from Daraja:
     Store CheckoutRequestID + MerchantRequestID
     UPDATE intent status = 'accepted'
8. On Daraja error (non-200 or errorCode in body):
     UPDATE intent status = 'failed'
     Return 422 to client with intent.id
9. Return { intentId, status, checkoutRequestId }
```

### 5.2 Callback Phase

```
POST /v1/mpesa/stk-callback  (public endpoint, no JWT)

1. INSERT mpesa_callback_logs (raw_payload, received_at) — always first, in own TX
2. Extract CheckoutRequestID from Body.stkCallback
3. Lookup intent by checkout_request_id
4. If intent not found: log warning, return 200 (Daraja must get 200 always)
5. [TX] SELECT mpesa_payment_intents FOR UPDATE WHERE id = intent.id
6.   IF status = 'success' → COMMIT, return 200 (idempotent)
7.   Extract ResultCode from Body.stkCallback.ResultCode
8.   IF ResultCode = 0 (success):
       a. Extract from CallbackMetadata items:
          - Amount
          - MpesaReceiptNumber
          - TransactionDate  (format: YYYYMMDDHHmmss)
          - PhoneNumber
       b. UPDATE intent:
            status = 'success'
            mpesaReceiptNumber = extracted
            resultCode = 0
            transactionDate = parsed
            completedAt = NOW()
       c. Call BuyerPaymentsService.create({
            tenantId:        intent.tenantId,
            buyerId:         intent.buyerId,
            amountKes:       intent.amountKes,
            paymentMethod:   'mpesa_stk',
            idempotencyKey:  'mpesa-stk-' + intent.mpesaReceiptNumber,
            requestedBy:     intent.requestedBy,
          })
          → PaymentAllocationService FIFO runs
          → buyers.balance_kes updated
       d. Store confirmedPaymentId = created BuyerPayment.id
       e. Build receipt (see §10)
   COMMIT
9.   IF ResultCode ≠ 0:
       status = 'cancelled' (if ResultCode=1032) or 'failed'
       resultDesc = Body.stkCallback.ResultDesc
       completedAt = NOW()
     COMMIT
10. UPDATE mpesa_callback_logs: processed_at, processing_status
11. Return HTTP 200 always (Daraja retries on non-200)
```

### 5.3 OAuth Token Management

```
GET https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
Authorization: Basic base64(consumerKey:consumerSecret)

Response: { access_token, expires_in }  // expires_in ≈ 3600

Caching strategy:
  - Cache token in memory (or Redis if clustered) keyed by tenant_id + environment
  - Cache TTL = expires_in - 60 seconds (60s buffer)
  - On cache miss or expiry: fetch new token
  - On Daraja 401: invalidate cache, fetch new token, retry once

MpesaTokenService:
  getToken(tenantId, environment): Promise<string>
    → check cache
    → if miss: fetchNewToken() → cache → return
```

### 5.4 Status Poll

```
GET /v1/mpesa/intents/:id/status
Authorization: Bearer <jwt>

Returns:
{
  id, status, amountKes, phoneNumber, buyerId,
  mpesaReceiptNumber, resultCode, resultDesc,
  createdAt, completedAt
}

Used by UI to poll until status ≠ 'accepted'
Recommended poll: every 5 seconds, timeout after 3 minutes
```

---

## 6. STK Query / Reconciliation

When a callback does not arrive within the expected window (~120s), the reconciliation flow queries Daraja for the result.

```
STK Query:
POST https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query
{
  BusinessShortCode: config.shortcode,
  Password:          password,
  Timestamp:         timestamp,
  CheckoutRequestID: intent.checkoutRequestId
}

Response: ResultCode (0=success), ResultDesc

Reconciliation job (runs every 2 minutes):
  1. Find intents WHERE status='accepted' AND created_at < NOW() - 3 minutes
  2. For each: call STK Query
  3. If ResultCode=0: process same as callback success path
  4. If ResultCode=1032: mark cancelled
  5. If ResultCode=other: mark failed
  6. If Daraja returns error: mark timeout, schedule retry
  7. All processing is idempotent — checks status before acting
  8. INSERT mpesa_callback_logs with type='transaction_status_result'

Hard timeout: intents WHERE status='accepted' AND created_at < NOW() - 15 minutes
  → mark timeout, no further reconciliation attempts
  → operator may retry with new intent + idempotency key
```

**Idempotency guarantee for reconciliation:** The reconciliation path uses the same lock-and-check pattern as the callback path (`FOR UPDATE` + status check). If both callback and reconciliation query arrive at nearly the same time, exactly one will win the lock; the other sees `status='success'` and exits cleanly.

---

## 7. B2C Supplier Payout Flow (Design Only)

**Do not implement in R8.0. Full implementation in R8.4+.**

```
POST /v1/mpesa/b2c-payout
Body: { supplierId, amountKes, phoneNumber, idempotencyKey }

1. INSERT MpesaPaymentIntent (direction=disbursement, channel=b2c, status=pending)
2. Generate OriginatorConversationID (UUID)
3. POST https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest
   {
     InitiatorName:        config.initiatorName,
     SecurityCredential:   config.securityCredential,  // encrypted with Safaricom public key
     CommandID:            "BusinessPayment",
     Amount:               amountKes,
     PartyA:               config.b2cShortcode,
     PartyB:               phoneNumber,                 // supplier phone
     Remarks:              transactionDesc,
     QueueTimeOutURL:      config.callbackBaseUrl + "/mpesa/b2c-timeout",
     ResultURL:            config.callbackBaseUrl + "/mpesa/b2c-result",
     Occasion:             accountReference
   }
4. Store OriginatorConversationID + ConversationID
5. Update intent status = accepted

B2C Result callback (POST /v1/mpesa/b2c-result):
  IF ResultCode=0:
    Extract TransactionID (receipt), TransactionAmount
    [TX] lock intent FOR UPDATE
    IF already success → exit (idempotent)
    Call SupplierPaymentsService.create(...)
      → FIFO allocation to oldest unpaid purchases
      → suppliers.balance_kes updated
    Mark intent success + confirmedPaymentId

B2C Timeout callback (POST /v1/mpesa/b2c-timeout):
  Mark intent timeout
  Log raw payload
  Allow operator to retry with new intent

Transaction Status Query (for reconciliation):
  POST /mpesa/transactionstatus/v1/query using ConversationID
  Same processing path as B2C result on success
```

---

## 8. Callback Handling Design

### Endpoint security

Callback endpoints are **public** (no JWT — Safaricom cannot send auth headers). Security is achieved by:

1. **Always log first:** Write raw payload to `mpesa_callback_logs` before any processing. Nothing is ever lost.
2. **Payload shape validation:** Reject malformed payloads (missing `Body.stkCallback`, missing `ResultCode`) with 200 (not 400 — must not cause Daraja to retry with valid callbacks).
3. **Idempotency by receipt number:** `mpesa_receipt_number` has a `UNIQUE` index. Duplicate confirmed callbacks attempting to create a second `BuyerPayment` are blocked by the idempotency key on the payment (`'mpesa-stk-' + mpesaReceiptNumber`).
4. **Tenant lookup from intent:** `tenant_id` is derived from `mpesa_payment_intents` via `checkout_request_id`. Never trust client-supplied `tenant_id` in callbacks.
5. **No shared secret in MVP:** Safaricom sandbox does not provide callback signing. Production implementation must validate payload against a shared IP allowlist or HMAC header when Safaricom provides this.
6. **Always return 200:** Any non-200 causes Daraja to retry. Return 200 even for unprocessable callbacks; log the reason in `mpesa_callback_logs.error_message`.

---

## 9. Web/Mobile UX Contract

### 9.1 Mobile (CS30 / Android POS)

**Pay screen changes (R8.2):**

```
Method picker: Cash | Bank | Mobile Money (manual) | M-Pesa STK
  → on M-Pesa STK selected:
      Show phone input (pre-fill buyer's registered phone if available)
      Show "Send STK Push" button

Pending screen:
  Title: "Waiting for M-Pesa"
  Body: "Ask [Buyer Name] to check their phone and enter their M-Pesa PIN."
  SubBody: "M-Pesa code: [accountReference]"
  Buttons: [Refresh Status]  [Cancel]
  Auto-refresh: every 5s
  Timeout: show "Taking longer than expected — check with customer" after 90s

Success screen (TransactionSuccess, M-Pesa):
  ✓ Payment Received
  Summary card:
    Buyer: [name]
    Amount: KES [amount]
    M-Pesa Code: [mpesaReceiptNumber]
    Phone: [phone]
    Method: M-Pesa STK
  Actions: [Print Receipt]  [View Receipt]  [Back Home]  [Record Another]

Failure screen:
  ✗ Payment Not Received
  Reason: [resultDesc — sanitized, no raw Daraja codes exposed]
  Common translations:
    1032 → "Customer cancelled the M-Pesa prompt"
    1037 → "M-Pesa prompt expired — request timed out"
    other → "M-Pesa payment was not completed"
  Buttons: [Retry (new STK)]  [Change Method]  [Back Home]
```

**Status badges (used in history rows):**

| `status` | Badge | Color |
|----------|-------|-------|
| `pending` | Pending | amber |
| `accepted` | Waiting PIN | amber |
| `success` | Paid via M-Pesa | green |
| `failed` | Failed | red |
| `cancelled` | Cancelled | neutral |
| `timeout` | Timed Out | red |
| `reversed` | Reversed | orange |

### 9.2 Web Dashboard

**Buyer payment drawer changes (R8.3):**

```
Payment method select: Cash | Bank | Mobile Money | M-Pesa STK
  → M-Pesa STK shows phone input + "Initiate STK Push" button
  → After initiation: inline status card in drawer showing pending/success/failed
  → Success: drawer shows M-Pesa receipt number + close button
  → Failure: shows reason + retry option

Supplier payment drawer changes (R8.4 — B2C):
  M-Pesa B2C option added when B2C configured for tenant
```

**M-Pesa history columns (buyer payments list):**

```
Columns: Date | Buyer | Amount | Method | M-Pesa Code | Status
  → M-Pesa Code shows mpesaReceiptNumber or "—"
  → Status badge per table above
  → Click row: intent detail modal (all fields, raw callback link for platform admins)
```

**Rules:**
- Never show payment as "paid" in buyer balance until `status = 'success'`
- Do not mark buyer balance reduced for pending/accepted intents
- Allow Refresh Status button on any accepted/pending row older than 30s

---

## 10. Receipt Integration

### Receipt field additions for M-Pesa payments

When a `BuyerPayment` or `SupplierPayment` is created via M-Pesa callback, the existing receipt builder (`buildBuyerPaymentReceipt`, `buildSupplierPaymentReceipt`) must include M-Pesa-specific lines.

**Proposed additions to `ReceiptData`:**

```typescript
interface ReceiptData {
  // existing fields...
  mpesaReceiptNumber?: string;     // M-Pesa confirmation code
  mpesaPhoneNumber?: string;       // phone that initiated the payment
  mpesaChannel?: 'M-Pesa STK' | 'M-Pesa B2C';
}
```

**Receipt lines for M-Pesa buyer payment:**

```
SALE RECEIPT (or BUYER PAYMENT RECEIPT)
─────────────────────────────────────
Buyer         : [buyer name]
Amount        : KES [amount]
Method        : M-Pesa STK
M-Pesa Code   : [mpesaReceiptNumber]
Phone         : [phoneNumber]
Date          : [transactionDate in EAT]
─────────────────────────────────────
Thank you · YardFlow POS
```

**Pending receipt rule:** Do not generate or print a payment receipt before intent reaches `status='success'`. A receipt generated for a `pending` or `accepted` intent would be fraudulent. The receipt builder must refuse to build an M-Pesa receipt without a `mpesaReceiptNumber`.

---

## 11. Security Rules

| Rule | Enforcement |
|------|-------------|
| Daraja credentials server-side only | Never returned in API responses; never in mobile bundle |
| `consumer_secret`, `passkey`, `security_credential` encrypted at rest | AES-256-GCM before DB write |
| Callback endpoints never expose secrets | Public endpoint validates shape only |
| `tenant_id` derived from DB, never from callback payload | Intent lookup by `checkout_request_id` |
| `mpesa_receipt_number` unique | DB UNIQUE index prevents duplicate payment creation |
| Payment created only by server-side service | Client cannot POST a confirmed M-Pesa payment directly |
| Raw callbacks always stored | `mpesa_callback_logs` written before processing; never deleted |
| Production callback IP allowlist | Safaricom publishes sandbox/production IPs; apply at load balancer |
| No auth bypass on operational endpoints | STK Push initiation still requires valid JWT + `buyer_payment:create` permission |

---

## 12. Environment Variables

```env
# Daraja environment
DARAJA_ENV=sandbox                          # sandbox | production
DARAJA_BASE_URL=https://sandbox.safaricom.co.ke

# OAuth credentials (NEVER commit to git)
DARAJA_CONSUMER_KEY=
DARAJA_CONSUMER_SECRET=

# STK Push (Paybill collection)
DARAJA_SHORTCODE=174379                     # sandbox default
DARAJA_PASSKEY=                             # sandbox passkey from Daraja portal
DARAJA_TRANSACTION_TYPE=CustomerPayBillOnline

# Callback routing
DARAJA_CALLBACK_BASE_URL=https://api.yardflow.app/v1
# For local dev: use ngrok or similar tunnel (Daraja cannot reach localhost)
# DARAJA_CALLBACK_BASE_URL=https://abc123.ngrok.io/v1

# B2C (activate in R8.4)
DARAJA_B2C_SHORTCODE=
DARAJA_INITIATOR_NAME=
DARAJA_SECURITY_CREDENTIAL=               # pre-encrypted with Safaricom sandbox pub key

# Token cache TTL buffer (seconds)
DARAJA_TOKEN_TTL_BUFFER=60
```

**.env.example** must include all keys with empty values. `.env` is gitignored. Real sandbox keys are stored in the team password manager.

---

## 13. Testing Plan

All tests run against the sandbox. No real money flows.

| # | Test | Type | Phase |
|---|------|------|-------|
| 1 | OAuth token fetch and cache | Unit | R8.1 |
| 2 | OAuth token refresh on expiry | Unit | R8.1 |
| 3 | STK password generation (base64 formula) | Unit | R8.1 |
| 4 | STK Push request payload shape | Unit (mock Daraja) | R8.1 |
| 5 | Intent created with status=pending before Daraja call | Integration | R8.1 |
| 6 | Intent updated to accepted after Daraja 200 | Integration | R8.1 |
| 7 | Intent marked failed if Daraja returns error | Integration | R8.1 |
| 8 | Callback success: ResultCode=0 creates BuyerPayment | e2e | R8.1 |
| 9 | Callback success: balance updated via R4 FIFO engine | e2e | R8.1 |
| 10 | Callback failure: ResultCode≠0 does NOT create BuyerPayment | e2e | R8.1 |
| 11 | Callback failure: balance_kes unchanged | e2e | R8.1 |
| 12 | Duplicate callback (same receipt number): idempotent, no double payment | e2e | R8.1 |
| 13 | Duplicate callback arrives before first is processed (race): exactly one payment | e2e | R8.1 |
| 14 | Callback with unknown CheckoutRequestID: 200, logged, no crash | e2e | R8.1 |
| 15 | Malformed callback payload: 200, logged, no crash | e2e | R8.1 |
| 16 | STK Query finds success after timeout: processed same as callback | e2e | R8.1 |
| 17 | Reconciliation job marks stale accepted intents as timeout | Integration | R8.1 |
| 18 | B2C result callback processes supplier payment via R4 engine | e2e | R8.4 |
| 19 | B2C timeout callback marks intent timeout, no balance change | e2e | R8.4 |
| 20 | Suspended tenant cannot initiate new STK Push | e2e | R8.1 |
| 21 | Phone number normalization (+254 format) | Unit | R8.1 |
| 22 | Amount ceiling for Daraja (integer, no decimals) | Unit | R8.1 |
| 23 | Receipt not generated before success status | Unit | R8.2 |
| 24 | M-Pesa receipt includes code, phone, channel | Unit | R8.2 |
| 25 | Token cache key is tenant-scoped (no cross-tenant token reuse) | Unit | R8.1 |

---

## 14. Failure Handling Rules

| Scenario | Behavior |
|----------|----------|
| Daraja OAuth fails | Return 503 to client; do not create intent |
| Daraja STK Push request fails (non-200) | Mark intent failed; return 422 with reason |
| Daraja STK Push returns malformed response | Mark intent failed; log payload |
| Callback not received within 3 min | Reconciliation job polls STK Query |
| STK Query also fails | Schedule retry; mark timeout after 15 min |
| Callback processing throws DB error | Callback logged (already written); intent stays accepted; retry on next reconciliation cycle |
| R4 BuyerPaymentsService throws after callback success | Transaction rolls back; intent status reverts; callback log marks failed; reconciliation will retry |
| Duplicate callbacks | Detected by `FOR UPDATE` + status check; second callback logged as `ignored` |
| B2C QueueTimeout callback | Mark intent timeout; log; operator retries manually |
| Token expiry during active request | Retry once with fresh token; return 503 on second failure |
| Safaricom maintenance window | Intent stays accepted; reconciliation eventually resolves |

---

## 15. Implementation Phases

| Phase | Milestone | Scope |
|-------|-----------|-------|
| R8.0 | Architecture | This document. Schema design, rules, env plan. No code. |
| R8.1 | API — STK Push | `MpesaModule`: token service, STK Push endpoint, callback handler, intent status poll, reconciliation job. Full test suite. Sandbox only. |
| R8.2 | Mobile UX | M-Pesa option in Pay screen, pending state, success/failure screens, receipt integration. |
| R8.3 | Web UX | M-Pesa option in buyer payment drawer, status badges, history columns. |
| R8.4 | B2C payout | B2C API implementation, supplier payout flow, mobile + web UX for disbursement. |
| R8.5 | Go live | Production Daraja credentials, per-tenant config in DB (encrypted), IP allowlist at load balancer. Real money. |

---

## 16. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Callback never arrives | High | Reconciliation job with STK Query; operator retry flow |
| Duplicate payment created from race condition | Critical | `FOR UPDATE` row lock + idempotency key on BuyerPayment |
| Daraja sandbox unreliable during development | Medium | Mock Daraja server for unit tests; sandbox for e2e |
| Credential leak in logs | Critical | Never log `consumer_secret`, `passkey`; log token as `[REDACTED]`; use structured logging |
| Phone number mismatch (buyer phone vs M-Pesa phone) | Medium | Pre-fill from buyer record; allow cashier override; show both on receipt |
| Amount rounding (KES cents) | Low | `Math.ceil()` before sending to Daraja; always compare in integer cents |
| STK Push not available in low-network areas | High | Keep manual payment as default; M-Pesa is an additional option, not replacement |
| B2C security credential rotation | High | Document rotation procedure; alert on approaching expiry |
| Multiple tenants sharing shortcode (Phase 2) | Medium | Resolved by `account_reference` field routing; design already accommodates this |
| Safaricom API versioning changes | Low | Abstract behind `DarajaClient` interface; version-lock base URL |
