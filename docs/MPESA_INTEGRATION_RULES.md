# YardFlow — M-Pesa Integration Rules

**Status:** Source of truth for all M-Pesa implementation  
**Version:** 1.0 (R8.0)  
**Related:** [SYSTEM_RULES.md](./SYSTEM_RULES.md) · [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) · [DATABASE_CONTRACTS.md](./DATABASE_CONTRACTS.md) · [R8_0_MPESA_ARCHITECTURE.md](../R8_0_MPESA_ARCHITECTURE.md)

---

## 1. Fundamental Rules (Never Break)

1. **M-Pesa never updates balances directly.** Every confirmed M-Pesa payment must flow through the existing R4 payment services (`BuyerPaymentsService`, `SupplierPaymentsService`) and the `PaymentAllocationService` FIFO engine. No Daraja callback handler may write to `buyers.balance_kes` or `suppliers.balance_kes` directly.

2. **No balance change before confirmation.** A `MpesaPaymentIntent` in status `pending` or `accepted` has zero effect on any party balance. Balances change only when status transitions to `success` and the R4 payment service completes successfully.

3. **Every callback is logged first.** Write the raw Daraja payload to `mpesa_callback_logs` in its own transaction before any processing begins. This log is never deleted. If processing fails, the raw payload survives for replay.

4. **Always return HTTP 200 to Daraja.** Non-200 causes Daraja to retry indefinitely. Return 200 for all callbacks — including unmatched, malformed, or already-processed ones. Log the reason in `mpesa_callback_logs.error_message`.

5. **Idempotency is non-negotiable.** The same confirmed callback arriving twice must produce exactly one `BuyerPayment` / `SupplierPayment`. Enforced by `UNIQUE(mpesa_receipt_number)` on the intent table and `UNIQUE(tenant_id, idempotency_key)` on payment tables. Use `'mpesa-stk-' + mpesaReceiptNumber` as the payment idempotency key.

6. **Credentials are server-side only.** `consumer_key`, `consumer_secret`, `passkey`, and `security_credential` must never appear in API responses, mobile bundles, or client-side code. They live in environment variables or the `tenant_mpesa_configs` table (encrypted).

7. **Tenant context comes from the database.** In callbacks, derive `tenant_id` by looking up the `MpesaPaymentIntent` via `checkout_request_id` or `originator_conversation_id`. Never trust a `tenant_id` supplied in the callback body.

8. **Receipts require confirmation.** Do not generate or print an M-Pesa payment receipt until the intent status is `success` and a `mpesaReceiptNumber` exists. Printing a receipt for a pending payment is fraudulent.

9. **Suspended tenants cannot initiate new M-Pesa operations.** The STK Push and B2C endpoints must check tenant status. In-flight intents already in `accepted` status may complete; no new initiation is allowed.

10. **Audit everything.** Every intent creation, status transition, callback receipt, and processing outcome must produce an entry in `audit_logs`.

---

## 2. Intent Lifecycle

### Status definitions

| Status | Meaning | Balance impact |
|--------|---------|----------------|
| `pending` | Intent created; Daraja request being sent | None |
| `accepted` | Daraja acknowledged; customer has received prompt | None |
| `success` | Callback ResultCode=0; payment confirmed and created | Applied via R4 engine |
| `failed` | Callback ResultCode≠0 (other than cancel) | None |
| `cancelled` | ResultCode=1032 (customer cancelled) | None |
| `timeout` | No callback in threshold window; reconciliation gave up | None |
| `reversed` | Confirmed payment was reversed (new record, not status mutation) | Handled by reversal flow |

### Allowed transitions

```
pending → accepted    (Daraja returns CheckoutRequestID)
pending → failed      (Daraja rejects the STK request itself)
accepted → success    (callback ResultCode=0)
accepted → failed     (callback ResultCode≠0, not cancel)
accepted → cancelled  (callback ResultCode=1032)
accepted → timeout    (reconciliation: no callback within threshold)
success → reversed    (handled by reversal record; intent row NOT mutated)
```

**No other transitions are valid.** The application must reject any attempt to move to an invalid state.

### Locking pattern for status transitions

All status transitions must use `SELECT ... FOR UPDATE` on the `MpesaPaymentIntent` row inside a database transaction. Always check the current status before applying the transition:

```typescript
// Correct pattern
await prisma.$transaction(async (tx) => {
  const intent = await tx.$queryRaw<[MpesaPaymentIntent]>`
    SELECT * FROM mpesa_payment_intents
    WHERE id = ${intentId}
    FOR UPDATE
  `;
  if (intent[0].status === 'success') return; // idempotent exit
  // ... apply transition
});
```

---

## 3. STK Push Rules

### Phone number normalization

All phone numbers stored and sent to Daraja must be in `+254...` format (no spaces, no dashes).

```
Input formats accepted from UI:
  07XXXXXXXX   → +2547XXXXXXXX
  2547XXXXXXXX → +2547XXXXXXXX
  +2547XXXXXXXX → +2547XXXXXXXX (no change)

Reject: invalid length, non-Kenyan prefixes (for MVP)
```

### Amount rules

- Daraja STK Push accepts **integers only** (no decimal KES).
- Send `Math.ceil(amountKes)` to Daraja. Always ceil, never floor, never round.
- Store the original `amountKes` (with decimals) on the intent and the resulting `BuyerPayment`.
- If the ceiling adds 1 KES, the buyer pays 1 KES more than the debt — treat as overpayment. Buyer overpayment is rejected by the R4 engine; validate before initiating STK.

### Account reference and description limits

- `AccountReference`: max 12 characters. Truncate if buyer name is longer.
- `TransactionDesc`: max 13 characters. Use a short description (e.g., "YardFlow Pay").

### Password generation

```typescript
const timestamp = format(new Date(), 'yyyyMMddHHmmss', { timeZone: 'Africa/Nairobi' });
const raw = shortcode + passkey + timestamp;
const password = Buffer.from(raw).toString('base64');
```

Always use the Africa/Nairobi timezone for the timestamp. Daraja validates this against server time.

### OAuth token caching

```typescript
// Cache per (tenant_id, environment) — NOT shared across tenants
const cacheKey = `mpesa_token:${tenantId}:${environment}`;
// TTL = expires_in - 60 seconds
// Invalidate and re-fetch on 401 from Daraja; retry once only
```

Do not log the raw access token. Log `"token_fetched"` or `"token_from_cache"` instead.

### Callback URL

The callback URL must be HTTPS and publicly reachable by Safaricom. For sandbox development, use an ngrok tunnel or similar. Never use `localhost` or private IPs.

Format: `{DARAJA_CALLBACK_BASE_URL}/mpesa/stk-callback`

---

## 4. Callback Handling Rules

### Write raw payload unconditionally

```typescript
// Step 1: Always persist the raw payload — in its own try/catch
try {
  await db.mpesaCallbackLog.create({
    data: {
      callbackType: 'stk_callback',
      externalReference: checkoutRequestId,
      rawPayload: body,
      receivedAt: new Date(),
      processingStatus: 'pending',
    },
  });
} catch (logError) {
  // Log to application logger but do not throw — must still return 200
  logger.error('Failed to write callback log', logError);
}
```

### Payload validation

Extract and validate these fields from the Daraja STK callback:

```
Body.stkCallback.MerchantRequestID  — string, required
Body.stkCallback.CheckoutRequestID  — string, required
Body.stkCallback.ResultCode         — number, required
Body.stkCallback.ResultDesc         — string, required
Body.stkCallback.CallbackMetadata.Item — array, only present when ResultCode=0
```

If shape is invalid: log with `processing_status='failed'`, return 200.

### CallbackMetadata item extraction

Items are an array of `{ Name, Value }` objects. Extract by name:

```typescript
function extractItem(items: Array<{Name: string; Value: unknown}>, name: string) {
  return items.find((i) => i.Name === name)?.Value;
}

const amount = extractItem(items, 'Amount');                 // number
const receiptNumber = extractItem(items, 'MpesaReceiptNumber');  // string
const transactionDate = extractItem(items, 'TransactionDate');   // number YYYYMMDDHHMMSS
const phoneNumber = extractItem(items, 'PhoneNumber');           // number
```

Note: `TransactionDate` and `PhoneNumber` arrive as numbers from Daraja; convert to string before storing.

### ResultCode meanings (STK Push)

| ResultCode | Meaning | Intent status |
|------------|---------|---------------|
| 0 | Success | `success` |
| 1 | Insufficient balance | `failed` |
| 1032 | Request cancelled by user | `cancelled` |
| 1037 | DS timeout user cannot be reached | `failed` |
| 2001 | Wrong PIN | `failed` |
| other | Various failure reasons | `failed` |

Do not expose raw ResultCode or ResultDesc to end users. Use the human-readable translations defined in the Mobile UX Contract (see [R8_0_MPESA_ARCHITECTURE.md §9.1](../R8_0_MPESA_ARCHITECTURE.md)).

---

## 5. Reconciliation Rules

### Reconciliation trigger conditions

The reconciliation job (runs every 2 minutes) processes:

- `MpesaPaymentIntent` WHERE `status = 'accepted'` AND `created_at < NOW() - 3 minutes`

It calls the Daraja STK Query for each and processes the result identically to a direct callback.

### Hard timeout

- `MpesaPaymentIntent` WHERE `status = 'accepted'` AND `created_at < NOW() - 15 minutes`
- Mark status = `timeout`
- No further reconciliation attempts
- Operator may create a new intent with a new idempotency key

### No double payment guarantee

The reconciliation path uses the same `SELECT ... FOR UPDATE` + status check as the callback path. If callback and reconciliation arrive simultaneously:

1. First to acquire the lock proceeds.
2. Second finds status already `success` or `failed` and exits cleanly.
3. The R4 payment service idempotency key (`'mpesa-stk-' + mpesaReceiptNumber`) provides a second layer of protection.

### Reconciliation is append-only

The reconciliation job only transitions intents to terminal states (`success`, `failed`, `cancelled`, `timeout`). It never modifies a terminal intent.

---

## 6. B2C Rules (Design — Active in R8.4+)

1. B2C requires a separate shortcode and B2C-enabled Daraja app credentials.
2. `SecurityCredential` must be the initiator password encrypted with the Safaricom **public key** for the environment (sandbox public key from Daraja portal).
3. Use `CommandID: "BusinessPayment"` for standard supplier payouts.
4. `OriginatorConversationID` must be globally unique; use a UUID.
5. B2C result callbacks (`ResultURL`) and timeout callbacks (`QueueTimeOutURL`) are separate endpoints.
6. `TransactionReceipt` (in B2C result) is the equivalent of `MpesaReceiptNumber` in STK Push.
7. B2C disbursements feed `SupplierPaymentsService`, not `BuyerPaymentsService`.
8. All other rules (log first, idempotent, no direct balance update) apply identically.

---

## 7. Database Rules

### Schema additions (supersede DATABASE_CONTRACTS.md §7)

`mpesa_transactions` (sketched in DATABASE_CONTRACTS §7) is replaced by:
- `mpesa_payment_intents` — intent lifecycle (see R8_0 §3.1)
- `mpesa_callback_logs` — raw callback audit (see R8_0 §3.2)
- `tenant_mpesa_configs` — per-tenant credentials (see R8_0 §3.3)

### Migration strategy

R8.1 migration:
1. Drop `mpesa_transactions` table if it exists (it was only a design sketch, never migrated in production).
2. Create the three new tables with correct enums, indexes, and constraints.
3. The existing `purchase_payments.payment_method` and `sale_payments.payment_method` enums already include `mpesa_stk` and `mpesa_b2c` — no change needed.

### Indexing requirements

```sql
-- Required indexes (all in R8_0 §3.1)
UNIQUE(checkout_request_id)                   -- for fast callback lookup
UNIQUE(originator_conversation_id)            -- for B2C callback lookup
UNIQUE(mpesa_receipt_number) WHERE NOT NULL   -- idempotency
INDEX(tenant_id, created_at DESC)             -- tenant history queries
INDEX(tenant_id, buyer_id)                    -- buyer payment history
INDEX(tenant_id, supplier_id)                 -- supplier payout history
```

### Decimal rules

- `amount_kes NUMERIC(14,2)` — same as all money fields in the system.
- Never store amounts as integers in the database; the ceiling happens only in the Daraja API call.

---

## 8. API Contract

### New endpoints (R8.1)

```
POST   /v1/mpesa/stk-push              — initiate STK Push (requires buyer_payment:create)
GET    /v1/mpesa/intents/:id/status    — poll intent status (requires payment:view)
POST   /v1/mpesa/stk-callback          — Daraja callback (public, no auth)
POST   /v1/mpesa/b2c-payout            — initiate B2C (requires supplier_payment:create) [R8.4]
POST   /v1/mpesa/b2c-result            — Daraja B2C result callback (public) [R8.4]
POST   /v1/mpesa/b2c-timeout           — Daraja B2C timeout callback (public) [R8.4]
```

### Permission mapping

| Endpoint | Required permission |
|----------|---------------------|
| STK Push initiation | `buyer_payment:create` |
| B2C payout initiation | `supplier_payment:create` |
| Intent status poll | `payment:view` |
| Callback endpoints | None (public) |

### Response contract for intent status

```typescript
interface MpesaIntentStatusResponse {
  id: string;
  status: MpesaIntentStatus;
  direction: 'collection' | 'disbursement';
  channel: 'stk_push' | 'b2c';
  amountKes: string;
  phoneNumber: string;
  buyerId: string | null;
  supplierId: string | null;
  mpesaReceiptNumber: string | null;    // only when success
  resultDesc: string | null;            // human-readable, not raw Daraja code
  createdAt: string;                    // ISO 8601
  completedAt: string | null;
  confirmedPaymentId: string | null;    // BuyerPayment.id or SupplierPayment.id
}
```

---

## 9. Receipt Contract

### When to generate an M-Pesa receipt

- Only when `intent.status = 'success'` and `intent.mpesaReceiptNumber` is set.
- The receipt is generated during the callback processing transaction, immediately after the R4 payment is confirmed.
- The `confirmedPaymentId` links to the `BuyerPayment` or `SupplierPayment` record, which can be used to reprint later.

### Required fields on M-Pesa payment receipt

```
receiptType:       'buyer_payment' | 'supplier_payment'
partyLabel:        'Buyer' | 'Supplier'
partyName:         buyer.name | supplier.name
lines:
  - { label: 'Method',      value: 'M-Pesa STK' | 'M-Pesa B2C' }
  - { label: 'M-Pesa Code', value: mpesaReceiptNumber }
  - { label: 'Phone',       value: phoneNumber }
  - { label: 'Date',        value: transactionDate in EAT }
totalLabel:        'Amount'
totalValue:        amountKes formatted
footer:            'Thank you · YardFlow POS'
```

### Receipt reprint

Reprinting an M-Pesa payment receipt uses the existing `buildBuyerPaymentReceipt` / `buildSupplierPaymentReceipt` builders, extended to accept `mpesaReceiptNumber`, `mpesaPhoneNumber`, and `mpesaChannel`. The full `BuyerPayment` / `SupplierPayment` record linked by `confirmedPaymentId` must be fetched from the DB for reprint — do not rely on client-cached data.

---

## 10. Testing Contracts

### What must be tested before R8.1 ships

1. Token fetched with correct Authorization header (`Basic base64(key:secret)`)
2. Token cached and reused within TTL
3. Token invalidated and refreshed on 401
4. STK password = `base64(shortcode + passkey + timestamp)` exactly
5. STK payload contains all 10 required fields with correct values
6. Callback: ResultCode=0 → BuyerPayment created exactly once
7. Callback: ResultCode=0 → `buyers.balance_kes` reduced by correct amount
8. Callback: ResultCode≠0 → no BuyerPayment created, balance unchanged
9. Duplicate callback (same MpesaReceiptNumber) → second call is no-op
10. Concurrent callbacks (race) → exactly one payment, no DB constraint error
11. Unknown CheckoutRequestID → 200, logged, no crash
12. Malformed payload → 200, logged, no crash
13. STK Query finds success → processes same as callback
14. Timeout threshold → intent marked timeout, no balance change
15. Suspended tenant → STK Push rejected with 403

---

## 11. Error Codes — Human-Readable Translations

Use these translations when showing M-Pesa errors to cashiers. Do not expose raw Daraja ResultCode values in UI.

| ResultCode | User-facing message |
|------------|---------------------|
| 1 | Customer's M-Pesa account has insufficient balance |
| 1032 | Customer cancelled the M-Pesa prompt |
| 1037 | M-Pesa prompt timed out — customer did not respond |
| 2001 | Customer entered the wrong M-Pesa PIN |
| (timeout — no callback) | M-Pesa payment took too long — please try again |
| (other) | M-Pesa payment was not completed — please try again |

---

## 12. Local Development Callback Strategy

### Why this is necessary

Daraja cannot send callbacks to:
- `localhost` (not publicly reachable)
- `127.0.0.1` or any loopback address
- Private LAN IPs (`192.168.x.x`, `10.x.x.x`)
- Android emulator IPs (`10.0.2.2`)

All callback endpoints must be publicly reachable over HTTPS with a valid TLS certificate. This is required for sandbox **and** production.

### Recommended tool: Cloudflare Tunnel

Cloudflare Tunnel is the preferred option. It is free, does not require an account for short-lived tunnels, and provides a stable HTTPS URL.

**Setup:**

```bash
# Install cloudflared (once)
# Windows: winget install --id Cloudflare.cloudflared
# Mac: brew install cloudflare/cloudflare/cloudflared

# Start tunnel pointing at the API (run alongside the API server)
cloudflared tunnel --url http://localhost:3001
```

Cloudflare will output a public URL such as:

```
https://yardflow-dev.trycloudflare.com
```

Set `DARAJA_CALLBACK_BASE_URL` accordingly:

```env
DARAJA_CALLBACK_BASE_URL=https://yardflow-dev.trycloudflare.com/v1
```

The full STK callback URL sent to Daraja becomes:

```
https://yardflow-dev.trycloudflare.com/v1/mpesa/stk-callback
```

**Characteristics of Cloudflare Tunnel short-lived URLs:**
- The subdomain changes each time `cloudflared` is restarted.
- For development, update `DARAJA_CALLBACK_BASE_URL` in `.env` when the tunnel restarts.
- For CI/staging, use a named tunnel (Cloudflare account required) to get a stable URL.

### Alternative: ngrok

```bash
ngrok http 3001
# Set DARAJA_CALLBACK_BASE_URL=https://abc123.ngrok.io/v1
```

ngrok free tier changes the subdomain on each restart. ngrok is acceptable for short testing sessions but Cloudflare Tunnel is preferred.

### Alternative: Public dev server

For persistent sandbox testing, deploy the API to a staging environment (Railway, Render, Fly.io). Use a fixed `DARAJA_CALLBACK_BASE_URL` pointing to staging. This is the most reliable approach for team development.

### What NEVER to do

- Do not expose a local port directly to the internet without TLS.
- Do not use an HTTP (not HTTPS) callback URL — Daraja rejects non-HTTPS.
- Do not share your tunnel URL publicly — anyone who knows it can send fake callbacks to your local server.

### Callback endpoint public requirements checklist

Before running the first sandbox STK Push test, verify:

- [ ] `DARAJA_CALLBACK_BASE_URL` is set in `.env`
- [ ] The URL is HTTPS and publicly reachable (test with `curl <URL>/health`)
- [ ] The tunnel/server is running
- [ ] The callback endpoint returns HTTP 200 for a test POST
- [ ] The raw payload write to `mpesa_callback_logs` works (test with a mock payload)

---

## 13. Glossary

| Term | Definition |
|------|------------|
| STK Push | Safaricom-initiated prompt sent to customer's phone to enter M-Pesa PIN |
| B2C | Business to Customer — yard sends money directly to supplier's M-Pesa |
| CheckoutRequestID | Daraja-assigned identifier for an STK Push session; used in callback matching |
| MerchantRequestID | Daraja-assigned identifier for the merchant's STK request |
| MpesaReceiptNumber | Safaricom's transaction confirmation code; used as idempotency anchor |
| OriginatorConversationID | Client-generated ID for B2C requests; used for reconciliation |
| Paybill | M-Pesa account type where customers pay a business number with an account reference |
| OAuth token | Short-lived bearer token (3600s) used to authenticate all Daraja API calls |
| FIFO allocation | Payment applied to oldest unpaid invoices first; implemented in R4 `PaymentAllocationService` |
| Callback | Async HTTP POST from Daraja to YardFlow's callback URL when a transaction completes |
| Reconciliation | Process of querying Daraja for transaction status when callbacks are delayed or missing |
