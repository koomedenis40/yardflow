// Enum value sets from DATABASE_CONTRACTS.md / SYSTEM_RULES.md.
// Declared as readonly tuples so they can be reused to build zod enums without drift.

export const TENANT_STATUS = ['trial', 'active', 'past_due', 'suspended', 'cancelled'] as const;
export type TenantStatus = (typeof TENANT_STATUS)[number];

export const USER_TENANT_ROLE = ['owner', 'cashier'] as const;
export type UserTenantRole = (typeof USER_TENANT_ROLE)[number];

export const PAYMENT_STATUS = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_METHOD = [
  'cash',
  'bank',
  'mobile_money_manual',
  'other_manual',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[number];

export const PAYMENT_SOURCE_TYPE = [
  'supplier_payment',
  'buyer_payment',
  'supplier_credit_pool',
] as const;
export type PaymentSourceType = (typeof PAYMENT_SOURCE_TYPE)[number];

/** Lifecycle state of a payment row (purchase_payments / sale_payments). */
export const PAYMENT_STATE = ['pending', 'confirmed', 'failed', 'reversed'] as const;
export type PaymentState = (typeof PAYMENT_STATE)[number];

export const MOVEMENT_TYPE = [
  'purchase',
  'sale',
  'purchase_correction',
  'sale_correction',
  'stock_adjustment',
] as const;
export type MovementType = (typeof MOVEMENT_TYPE)[number];

export const PAYMENT_ALLOCATION_PAYMENT_TYPE = ['purchase_payment', 'sale_payment'] as const;
export type PaymentAllocationPaymentType = (typeof PAYMENT_ALLOCATION_PAYMENT_TYPE)[number];

export const PAYMENT_ALLOCATION_TARGET_TYPE = ['purchase', 'sale'] as const;
export type PaymentAllocationTargetType = (typeof PAYMENT_ALLOCATION_TARGET_TYPE)[number];

export const CORRECTABLE_TYPE = ['purchase', 'sale'] as const;
export type CorrectableType = (typeof CORRECTABLE_TYPE)[number];

export const MPESA_DIRECTION = ['inbound', 'outbound'] as const;
export type MpesaDirection = (typeof MPESA_DIRECTION)[number];

export const MPESA_STATUS = ['pending', 'confirmed', 'failed', 'timeout', 'reversed'] as const;
export type MpesaStatus = (typeof MPESA_STATUS)[number];

export const RECEIPT_TYPE = [
  'purchase',
  'supplier_payment',
  'sale',
  'buyer_payment',
  'correction',
  'adjustment',
] as const;
export type ReceiptType = (typeof RECEIPT_TYPE)[number];

export const BILLING_CYCLE_STATUS = ['open', 'invoiced', 'paid', 'overdue', 'cancelled'] as const;
export type BillingCycleStatus = (typeof BILLING_CYCLE_STATUS)[number];
