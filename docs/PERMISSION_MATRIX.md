# YardFlow — Permission Matrix

**Status:** Source of truth (pre-implementation)  
**Version:** 1.1  
**Related:** [SYSTEM_RULES.md](./SYSTEM_RULES.md) · [TRANSACTION_FLOWS.md](./TRANSACTION_FLOWS.md) · [DELETION_AND_REVERSAL_RULES.md](./DELETION_AND_REVERSAL_RULES.md)

---

## 1. Roles

| Role | Scope | Description |
|------|-------|-------------|
| **Platform Admin** | Global | Tenant lifecycle, billing oversight, platform health |
| **Yard Owner** | Single tenant | Full yard operations |
| **Cashier** | Single tenant | Day-to-day purchase, sale, payment, print |

Implementation uses **permission strings** in JWT claims — not hard-coded role switches in business logic.

---

## 2. Role Definitions

### Platform Admin

- Create/update/suspend tenants  
- View platform metrics and audit (cross-tenant)  
- Manage subscription status  
- **Must not** create tenant operational records in MVP (no silent impersonation)  

### Yard Owner

- All cashier permissions  
- Corrections, stock adjustments, reports, users, categories, settings  
- Billing view and pay  
- Supplier/buyer full management  

### Cashier

- Purchase, sale, operational payments, receipt print/reprint  
- View stock and party balances  
- Quick-create supplier/buyer (minimal fields)  
- **Cannot:** corrections, adjustments, reports, users, billing, category management  

---

## 3. Permission Table

| Permission | Platform Admin | Yard Owner | Cashier |
|---|:---:|:---:|:---:|
| `platform:tenant:create` | ✓ | — | — |
| `platform:tenant:view` | ✓ | — | — |
| `platform:tenant:update_status` | ✓ | — | — |
| `platform:tenant:suspend` | ✓ | — | — |
| `tenant:view` | ✓ | own | — |
| `user:invite` | — | ✓ | — |
| `user:disable` | — | ✓ | — |
| `user:change_role` | — | ✓ | — |
| `category:create` | — | ✓ | — |
| `category:update` | — | ✓ | — |
| `category:deactivate` | — | ✓ | — |
| `supplier:create` | — | ✓ | ✓ |
| `supplier:update` | — | ✓ | limited† |
| `supplier:view` | — | ✓ | ✓ |
| `supplier:deactivate` | — | ✓ | — |
| `buyer:create` | — | ✓ | ✓ |
| `buyer:update` | — | ✓ | limited† |
| `buyer:view` | — | ✓ | ✓ |
| `buyer:deactivate` | — | ✓ | — |
| `purchase:create` | — | ✓ | ✓ |
| `purchase:view` | — | ✓ | ✓ |
| `purchase:correct` | — | ✓ | — |
| `sale:create` | — | ✓ | ✓ |
| `sale:view` | — | ✓ | ✓ |
| `sale:correct` | — | ✓ | — |
| `supplier_payment:create` | — | ✓ | ✓ |
| `buyer_payment:create` | — | ✓ | ✓ |
| `payment:view` | — | ✓ | ✓ |
| `inventory:view` | — | ✓ | ✓ |
| `inventory:adjust` | — | ✓ | — |
| `receipt:print` | — | ✓ | ✓ |
| `receipt:reprint` | — | ✓ | ✓ |
| `report:view` | — | ✓ | — |
| `report:export` | — | ✓ | — |
| `billing:view` | ✓ | ✓ | — |
| `billing:pay` | — | ✓ | — |
| `audit:view` | ✓ | ✓ | — |
| `settings:update` | — | ✓ | — |
| `data:export` | — | ✓ | — |

† **Cashier limited update:** `full_name`, `phone`, `location` only.

---

## 4. Suspended Tenant Permissions

When `tenants.status = suspended`:

| Permission | Owner | Cashier |
|---|:---:|:---:|
| `auth:login` | ✓ | ✓ |
| `tenant:view` | ✓ | ✓ |
| `purchase:view` | ✓ | ✓ |
| `sale:view` | ✓ | ✓ |
| `inventory:view` | ✓ | ✓ |
| `receipt:reprint` | ✓ | ✓ |
| `report:view` | ✓ | — |
| `billing:view` | ✓ | — |
| `billing:pay` | ✓ | — |
| `data:export` | ✓ | — |
| `purchase:create` | **✗** | **✗** |
| `sale:create` | **✗** | **✗** |
| `supplier_payment:create` | **✗** | **✗** |
| `buyer_payment:create` | **✗** | **✗** |
| `inventory:adjust` | **✗** | **✗** |
| `purchase:correct` | **✗** | **✗** |
| `sale:correct` | **✗** | **✗** |

**Note:** Operational M-Pesa and party payments are blocked; **`billing:pay`** remains allowed so the yard can restore service.

---

## 5. Correction & Adjustment Gates

| Action | Permission | Extra requirements |
|--------|------------|-------------------|
| Purchase correction | `purchase:correct` | Mandatory reason; stock safety check; audit |
| Sale correction | `sale:correct` | Mandatory reason; audit |
| Stock adjustment | `inventory:adjust` | Mandatory reason; owner only; audit |

Preview endpoint (owner): show stock/balance/billing impact before confirm.

---

## 5a. Deactivation Gates (no deletion)

Operational ledger records are **never deletable** (see [DELETION_AND_REVERSAL_RULES.md](./DELETION_AND_REVERSAL_RULES.md)). Only setup records may be **deactivated**, owner-only, subject to API-enforced safety checks:

| Action | Permission | Block conditions (API-enforced) |
|--------|------------|----------------------------------|
| Deactivate supplier | `supplier:deactivate` | Outstanding balance, unresolved credit, or unpaid/partial purchases |
| Deactivate buyer | `buyer:deactivate` | Outstanding receivable or unpaid/partial sales |
| Deactivate category | `category:deactivate` | Stock on hand > 0, or active transaction dependency (may require explicit owner approval) |
| Disable user | `user:disable` | Cannot disable sole active owner; users are **disabled, never deleted** |

Blocked deactivations return a clear human-readable reason. Cashiers cannot deactivate any record.

---

## 6. Platform Admin Support Access (Future)

MVP: **disabled.**

Phase 2 support impersonation requires:

- Owner-approved time-limited session  
- All actions tagged `support_actor_id` in audit  
- Read-only default; write requires explicit owner consent  

---

## 7. API Enforcement

Every mutating route declares required permissions:

```txt
@RequirePermissions('purchase:create')
@TenantGuard()
@NotSuspended()   // except billing:pay
```

| Layer | Responsibility |
|-------|----------------|
| API guards | Authoritative enforcement |
| Frontend | Hide/disable UI only — not security |

---

## 8. JWT Claims (MVP)

```json
{
  "sub": "user_uuid",
  "tenant_id": "tenant_uuid",
  "role": "owner | cashier",
  "permissions": ["purchase:create", "..."],
  "is_platform_admin": false
}
```

Platform admin tokens omit `tenant_id` for global routes; separate issuer scope recommended.

---

## 9. POS Device Context (Optional)

Register `device_id` per handset:

- Included in audit metadata  
- Rate limits per device  
- No additional permissions beyond cashier user  
