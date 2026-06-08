# R7.8 — Pre-M-Pesa Readiness Gate

**Milestone:** R7.8 — Pre-M-Pesa Readiness  
**Date:** 2026-06-08  
**Status:** Complete  
**Base:** R8.0 (`630b849`)  
**Scope:** Documentation and design freeze only. No STK Push. No B2C. No real money.

---

## 1. Summary

This milestone closes all prerequisite gaps before R8.1 (STK Push implementation) can begin safely. It freezes payment business rules, confirms Daraja sandbox readiness, documents callback tunnel strategy, and designs the CS30 built-in printer adapter architecture.

---

## 2. Files Created / Updated

| File | Action | Purpose |
|------|--------|---------|
| `docs/PAYMENT_BUSINESS_RULES.md` | Created | Frozen payment business rules for buyer collections and supplier payouts |
| `docs/CS30_DEVICE_INTEGRATION.md` | Created | CS30 SDK findings and PrinterAdapter architecture design |
| `docs/MPESA_INTEGRATION_RULES.md` | Updated | Added §12 Local Development Callback Strategy (tunnel options) |
| `.env.example` | Updated | Added all Daraja sandbox variables with placeholders |
| `R7_8_PRE_MPESA_READINESS_REPORT.md` | Created | This report |

---

## 3. Payment Business Rules — Frozen

Full rules in `docs/PAYMENT_BUSINESS_RULES.md`. Key points:

### Buyer Collections

| Rule | Value |
|------|-------|
| Partial payment | Allowed |
| Multiple payments | Allowed |
| Overpayment | **NOT allowed** — 422 BUYER_OVERPAYMENT_NOT_ALLOWED |
| STK Push amount suggestion | Pre-fill with `buyer.balanceKes`; cashier can reduce, cannot exceed |
| Daraja integer requirement | `Math.ceil(amountKes)` before sending; validate no ceiling-induced overpay |
| Zero amount | Rejected |
| Balance change timing | Only after `status=success` + R4 FIFO engine completes |
| Pending STK accounting effect | None — buyer balance unchanged until confirmed |
| Phone pre-fill | From `buyer.phone`; cashier can edit; owner/admin can override |

### Supplier Payments

| Rule | Value |
|------|-------|
| B2C initiation | Owner/Admin only (cashier cannot) |
| Payout phone default | `supplier.phone` |
| Cashier phone change | Not allowed |
| Owner/Admin phone change | Allowed |
| Max single B2C payout | KES 70,000 (Daraja limit) |
| Balance change timing | Only after confirmed B2C callback |
| Credit pool | Unaffected by B2C in MVP |

---

## 4. Daraja Sandbox Readiness

### Confirmed sandbox values

| Variable | Value | Notes |
|----------|-------|-------|
| `DARAJA_ENV` | `sandbox` | |
| `DARAJA_BASE_URL` | `https://sandbox.safaricom.co.ke` | |
| `DARAJA_SHORTCODE` | `174379` | Standard sandbox Paybill number |
| `DARAJA_TRANSACTION_TYPE` | `CustomerPayBillOnline` | For Paybill collection |
| `DARAJA_TEST_PHONE` | `254708374149` | Safaricom sandbox test phone |

### Where to get sandbox credentials

| Credential | Source |
|------------|--------|
| `DARAJA_CONSUMER_KEY` | Daraja app card at `developer.safaricom.co.ke` |
| `DARAJA_CONSUMER_SECRET` | Same Daraja app card |
| `DARAJA_PASSKEY` | M-Pesa Express Simulator section on Daraja portal |
| `DARAJA_SECURITY_CREDENTIAL` | Not needed for STK Push — only for B2C (R8.4+) |

### What is NOT needed for R8.1 STK Push

- `DARAJA_B2C_SHORTCODE` — B2C only
- `DARAJA_INITIATOR_NAME` — B2C only
- `DARAJA_SECURITY_CREDENTIAL` — B2C only

---

## 5. Callback Strategy — Confirmed

Full documentation in `docs/MPESA_INTEGRATION_RULES.md §12`.

### Why tunnelling is required

Daraja cannot call `localhost`, private LAN IPs, or emulator IPs. A public HTTPS URL is mandatory for both sandbox and production.

### Preferred tool: Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3001
# Output: https://yardflow-dev.trycloudflare.com

# Set in .env:
# DARAJA_CALLBACK_BASE_URL=https://yardflow-dev.trycloudflare.com/v1
```

Cloudflare Tunnel is free, requires no account for short-lived sessions, and provides a valid HTTPS URL automatically. Preferred over ngrok for this project.

### Callback URL format

```
{DARAJA_CALLBACK_BASE_URL}/mpesa/stk-callback
```

Example: `https://yardflow-dev.trycloudflare.com/v1/mpesa/stk-callback`

### Pre-flight checklist before first STK test

- [ ] `DARAJA_CALLBACK_BASE_URL` set in `.env`
- [ ] URL is HTTPS, publicly reachable (`curl <URL>/health` returns 200)
- [ ] Tunnel/server running
- [ ] Callback endpoint returns 200 on test POST
- [ ] Raw callback write to `mpesa_callback_logs` tested with mock payload

---

## 6. CS30 Device Integration — Architecture Designed

Full specification in `docs/CS30_DEVICE_INTEGRATION.md`.

### Key findings

| Finding | Detail |
|---------|--------|
| CS30 Pro SDK | AIDL-based; uses `PosApiHelper.java` + `ICiontekPosService.aidl` |
| Runtime requirement | Android 10.0, build `a51_v0.08_20210324c` or later |
| Paper width | 58mm, 32 characters per line — same as existing `COLS_58MM = 32` constant |
| Print method | Text-based `PrintStr()` calls (not ESC/POS byte stream) |
| Status codes | 0=ready, 1=no paper, 2=too hot, 3=low voltage, 4=busy, 8=timeout, 16=data error |

### Adapter architecture

```
ReceiptData
    │
    ▼
PrinterAdapterFactory
    ├─ CS30BuiltInPrinterAdapter   (primary — auto-detected on CS30)
    ├─ BluetoothEscposPrinterAdapter  (fallback — existing BT flow)
    └─ FuturePdfShareAdapter         (future — WhatsApp/email)
```

### Implementation status

| Component | Status |
|-----------|--------|
| `PrinterAdapter` interface | Designed (R7.8); implement in R8.3 |
| `CS30BuiltInPrinterAdapter` | Designed; requires CS30 native module (R8.3) |
| `BluetoothEscposPrinterAdapter` | Designed as thin wrapper over existing `printer.service.ts` |
| CS30 native module (Java/Kotlin) | Not yet implemented |
| `printer.context.tsx` adapter refactor | R8.3 |

**No breaking changes to existing Bluetooth printing in this milestone.** The adapter refactor is deferred to R8.3.

---

## 7. Pre-R8 Checklist

- [x] Payment business rules frozen (`docs/PAYMENT_BUSINESS_RULES.md`)
- [x] Daraja sandbox credentials identified (source documented; secrets in password manager, not committed)
- [x] Callback tunnel plan documented (`docs/MPESA_INTEGRATION_RULES.md §12`)
- [x] CS30 built-in printer strategy documented (`docs/CS30_DEVICE_INTEGRATION.md`)
- [x] Existing manual payments still work (no code changes to payment flows)
- [x] Existing receipt preview/print flow still works (no changes to printing layer)
- [x] `.env.example` updated with all Daraja variables (placeholders only)
- [x] No STK Push implemented
- [x] No B2C implemented
- [x] All four validation checks pass

---

## 8. What R8.1 Can Now Safely Start

With this milestone complete, R8.1 STK Push implementation can begin with:

1. **Business rules locked** — amount validation, phone normalization, balance-change timing, idempotency requirements all defined and agreed.
2. **Sandbox credentials identified** — team knows exactly where to get `CONSUMER_KEY`, `CONSUMER_SECRET`, `PASSKEY`; `SHORTCODE=174379` and `TEST_PHONE=254708374149` confirmed.
3. **Callback endpoint plan confirmed** — Cloudflare Tunnel documented; pre-flight checklist ready.
4. **Architecture locked** — `R8_0_MPESA_ARCHITECTURE.md` and `docs/MPESA_INTEGRATION_RULES.md` define the complete design including the 25-test plan that must pass before R8.1 ships.
5. **No design debt** — all open questions from R8.0 are answered.

---

## 9. Validation

| Check | Result |
|-------|--------|
| `pnpm --filter @yardflow/pos typecheck` | ✅ Exit 0 |
| `pnpm --filter @yardflow/api test` | ✅ 54 tests passed |
| `pnpm --filter @yardflow/theme build` | ✅ Exit 0 |
| `pnpm --filter @yardflow/web build` | ✅ Exit 0 |

No code changes were made to any application source file. All validations pass on existing code.
