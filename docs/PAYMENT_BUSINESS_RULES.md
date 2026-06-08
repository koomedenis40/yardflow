# YardFlow — Payment Business Rules

**Status:** Frozen (R7.8 — pre-M-Pesa readiness gate)  
**Version:** 1.0  
**Related:** [SYSTEM_RULES.md](./SYSTEM_RULES.md) · [MPESA_INTEGRATION_RULES.md](./MPESA_INTEGRATION_RULES.md) · [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) · [PERMISSION_MATRIX.md](./PERMISSION_MATRIX.md)

---

## 1. Purpose

This document defines the exact business rules for how payments are created, validated, and processed in YardFlow. Rules in this document apply equally to manual payments (cash, bank, mobile money manual) and to M-Pesa payments. Where a rule applies only to one channel, it is marked clearly.

These rules are frozen as of R7.8 and must not change without a documented design decision. The R8.1 STK Push implementation must pass every rule in §2 and §3 before going live.

---

## 2. Buyer Collection Rules

### 2.1 Who can collect from a buyer

| Action | Cashier | Owner/Admin |
|--------|:-------:|:-----------:|
| Manual payment (cash, bank) | ✓ | ✓ |
| Initiate STK Push | ✓ | ✓ |
| Cancel pending STK Push | ✓ | ✓ |
| View M-Pesa intent status | ✓ | ✓ |
| Override phone for STK Push | — | ✓ |

### 2.2 Amount rules

1. **Partial payment is allowed.** A buyer can pay any amount between KES 1 and their full outstanding balance. There is no minimum payment floor beyond KES 1.

2. **Multiple payments are allowed.** A buyer may make multiple payments against the same balance over time. Each payment is a separate append-only record allocated FIFO.

3. **Buyer overpayment is NOT allowed.** Payment amount must not exceed `buyer.balanceKes` (the outstanding receivable). The API returns `422 BUYER_OVERPAYMENT_NOT_ALLOWED` if the amount exceeds the balance.

4. **STK Push amount suggestion.** When initiating an STK Push, the UI must pre-fill the amount with the buyer's current outstanding balance (`buyer.balanceKes`). The cashier may reduce this amount. The cashier may not increase it above the balance.

5. **Daraja integer requirement.** Daraja STK Push accepts only integer KES amounts. Use `Math.ceil(amountKes)` when sending to Daraja. Validate that `Math.ceil(amountKes) <= Math.floor(buyer.balanceKes)` before initiating to avoid a ceiling-induced overpayment rejection.

6. **Zero amount is rejected.** A payment of KES 0 is invalid regardless of channel.

### 2.3 Balance effect timing

| Payment channel | When balance changes |
|-----------------|---------------------|
| Cash / bank / mobile money manual | Immediately on POST — payment confirms at creation |
| M-Pesa STK Push (pending) | No change — `buyer.balanceKes` unchanged |
| M-Pesa STK Push (accepted) | No change — waiting for customer PIN |
| M-Pesa STK Push (success) | Balance reduced — after R4 FIFO engine runs via callback |
| M-Pesa STK Push (failed/cancelled/timeout) | No change |

**Rule:** Do not show a buyer's balance as reduced until the M-Pesa intent status is `success` and the `BuyerPayment` record has been created by the callback handler.

### 2.4 FIFO allocation

All buyer payments (manual and M-Pesa confirmed) are allocated using FIFO: oldest unpaid sales first, then next oldest, and so on. This is handled by `PaymentAllocationService` and applies equally regardless of payment channel.

A payment may optionally specify a `saleId` to link to a specific sale first, before FIFO applies to the remainder.

### 2.5 Phone number for STK Push

- Pre-fill from `buyer.phone` if available.
- Cashier can edit the phone number before sending.
- Owner/Admin can override if buyer phone is incorrect.
- Phone must be normalized to `+254XXXXXXXXX` before sending to Daraja.
- Accepted input formats: `07XXXXXXXX`, `2547XXXXXXXX`, `+2547XXXXXXXX`.

### 2.6 Pending STK accounting effect

A `MpesaPaymentIntent` in `pending` or `accepted` status:
- Has zero effect on `buyers.balance_kes`
- Does not appear in payment allocations
- Does not affect payment status on any sale
- Does appear in the intent history list for reference
- Is shown to the cashier with a "Waiting for PIN" badge

---

## 3. Supplier Payment Rules

### 3.1 Who can pay a supplier

| Action | Cashier | Owner/Admin |
|--------|:-------:|:-----------:|
| Manual payment (cash, bank) | ✓ | ✓ |
| Initiate B2C payout | — | ✓ |
| Change supplier payout phone | — | ✓ |
| Set payout limit | — | ✓ |
| View B2C intent status | ✓ | ✓ |

**Rule:** B2C supplier payout is owner/admin-only. The cashier sees the M-Pesa B2C option only if they have the `supplier_payment:create` permission AND the tenant owner has explicitly granted M-Pesa B2C to cashier role. Default: cashier cannot initiate B2C.

### 3.2 Payout phone rules

1. **Default is supplier registered phone.** When initiating a B2C payout, the payout phone defaults to `supplier.phone`.

2. **Cashier cannot change payout phone.** The payout phone field is read-only for cashier role. This prevents misdirected payouts.

3. **Owner/admin can change payout phone.** If the supplier's phone has changed, or the payout should go to a different number in this specific case, an owner/admin can override the phone.

4. **Phone normalization rules apply.** Same as buyer collection — normalize to `+254XXXXXXXXX`.

### 3.3 Payout limits (configurable)

Payout limits protect against large unauthorized disbursements. These are configurable per tenant by the owner.

| Limit | Default | Notes |
|-------|---------|-------|
| Maximum single B2C payout | KES 70,000 | Daraja B2C limit per transaction |
| Daily B2C payout ceiling | Configurable | Optional per-tenant policy |
| Require 2nd approval above threshold | — | Future milestone |

**For MVP (R8.4 B2C):** Apply only the Daraja per-transaction limit (KES 70,000). Per-day ceiling and dual-approval are future phases.

### 3.4 Balance effect timing (supplier)

| Payment channel | When balance changes |
|-----------------|---------------------|
| Cash / bank / mobile money manual | Immediately on POST |
| B2C (pending/accepted) | No change |
| B2C (success callback) | Balance reduced via R4 FIFO engine |
| B2C (failed/timeout) | No change |

**Rule:** Never reduce `suppliers.balance_kes` until the B2C payout is confirmed via callback. The same `FOR UPDATE` + idempotency pattern as STK Push applies.

### 3.5 Supplier credit pool

The supplier credit pool (advance payments resulting in `supplier.creditBalanceKes > 0`) is **not affected by M-Pesa B2C** in MVP. B2C payouts are simple payments against the outstanding balance. Credit pool behavior is unchanged from R4.

### 3.6 B2C implementation status

B2C is designed (R8.0 architecture) but not yet implemented. The business rules in this section are locked and will be enforced when B2C is implemented in R8.4+.

---

## 4. General Payment Rules (All Channels)

### 4.1 Append-only

All payment records are append-only. No payment row is ever updated or deleted. Mistakes are corrected via reversal records (new append-only rows). This applies to `BuyerPayment`, `SupplierPayment`, and `MpesaPaymentIntent`.

### 4.2 Idempotency required

All payment initiation calls must include an `Idempotency-Key`. The server deduplicates by `(tenant_id, idempotency_key)`. Replaying with the same key returns the original response, no double payment.

### 4.3 Payment methods

| Method | Code | Notes |
|--------|------|-------|
| Cash | `cash` | Manual, immediate confirm |
| Bank transfer | `bank` | Manual, immediate confirm |
| Mobile money (manual) | `mobile_money_manual` | Manual entry, immediate confirm |
| M-Pesa STK Push | `mpesa_stk` | Async — pending until callback |
| M-Pesa B2C | `mpesa_b2c` | Async — pending until callback (R8.4+) |

### 4.4 Tenant suspension

Suspended tenants may not initiate new payments of any channel. In-flight M-Pesa intents already in `accepted` status may complete; the callback handler checks suspension status before creating the BuyerPayment, and if suspended, marks the intent `failed` instead.

### 4.5 Permission enforcement

The payment permission checks from `PERMISSION_MATRIX.md` apply to all channels:
- `buyer_payment:create` — required for all buyer payment types including STK Push
- `supplier_payment:create` — required for all supplier payment types
- B2C additionally requires owner/admin role (enforced at API level, not only at UI level)

---

## 5. Receipt Rules

### 5.1 Manual payments

Receipts are generated synchronously as part of the payment creation transaction. Receipt is available immediately in the API response and on the POS success screen.

### 5.2 M-Pesa payments

Receipts for M-Pesa payments are generated **only after the intent reaches `success` status** and the `BuyerPayment` / `SupplierPayment` has been created by the callback handler.

| Intent status | Receipt available |
|---------------|:----------------:|
| `pending` | No |
| `accepted` | No |
| `success` | Yes |
| `failed` | No |
| `cancelled` | No |
| `timeout` | No |

A receipt generated for a pending M-Pesa payment would be fraudulent. The system must not allow printing or displaying a confirmed-payment receipt before `status = success`.

### 5.3 Pending state UX

During the M-Pesa pending/accepted window, the POS must show:
- The intent amount and buyer name
- Status: "Waiting for M-Pesa PIN"
- A Refresh Status button
- A Cancel button (only if intent is still accepted, not yet processed by Daraja)
- No Print Receipt button
- No receipt QR or reference that implies payment is confirmed

---

## 6. Conflict Resolution

When a situation arises that these rules do not cover, apply the priority order from `SYSTEM_RULES.md §3`:

1. Stock integrity
2. Tenant isolation
3. Append-only ledger
4. **Payment confirmation** — balances update only on confirmed payments
5. Projections
6. UX convenience

UX convenience (pre-filling amounts, showing pending badges) never overrides rules 1–5.
