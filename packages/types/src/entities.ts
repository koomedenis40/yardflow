import type { Money, UUID, WeightKg, ISODateString } from './common';
import type {
  BillingCycleStatus,
  CorrectableType,
  MovementType,
  MpesaDirection,
  MpesaStatus,
  PaymentAllocationPaymentType,
  PaymentAllocationTargetType,
  PaymentMethod,
  PaymentState,
  PaymentStatus,
  ReceiptType,
  TenantStatus,
  UserTenantRole,
} from './enums';

// Entity shapes mirror DATABASE_CONTRACTS.md. Field names are camelCased
// application-layer representations of the snake_case DB columns.

export interface Tenant {
  id: UUID;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string;
  currency: string;
  receiptPrefix: string;
  settings: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface User {
  id: UUID;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPlatformAdmin: boolean;
  createdAt: ISODateString;
}

export interface UserTenant {
  userId: UUID;
  tenantId: UUID;
  role: UserTenantRole;
  isActive: boolean;
  createdAt: ISODateString;
}

export interface ScrapCategory {
  id: UUID;
  tenantId: UUID;
  yardId: UUID | null;
  name: string;
  defaultBuyingPricePerKg: Money;
  defaultSellingPricePerKg: Money;
  isActive: boolean;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Supplier {
  id: UUID;
  tenantId: UUID;
  yardId: UUID | null;
  fullName: string;
  phone: string | null;
  idNumber: string | null;
  location: string | null;
  notes: string | null;
  /** Projection: amount owed TO the supplier. */
  balanceKes: Money;
  /** Projection: unallocated advance held for the supplier. */
  creditBalanceKes: Money;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Buyer {
  id: UUID;
  tenantId: UUID;
  yardId: UUID | null;
  fullName: string;
  phone: string | null;
  idNumber: string | null;
  location: string | null;
  notes: string | null;
  /** Projection: amount owed BY the buyer. */
  balanceKes: Money;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Purchase {
  id: UUID;
  tenantId: UUID;
  yardId: UUID | null;
  supplierId: UUID;
  categoryId: UUID;
  weightKg: WeightKg;
  buyingPricePerKg: Money;
  totalValueKes: Money;
  amountPaidAtCreationKes: Money;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdBy: UUID;
  idempotencyKey: string;
  createdAt: ISODateString;
}

export interface Sale {
  id: UUID;
  tenantId: UUID;
  yardId: UUID | null;
  buyerId: UUID;
  categoryId: UUID;
  weightKg: WeightKg;
  sellingPricePerKg: Money;
  totalValueKes: Money;
  amountReceivedAtCreationKes: Money;
  paymentStatus: PaymentStatus;
  costPerKgAtSale: Money;
  cogsKes: Money;
  grossProfitKes: Money;
  createdBy: UUID;
  idempotencyKey: string;
  createdAt: ISODateString;
}

export interface PurchasePayment {
  id: UUID;
  tenantId: UUID;
  supplierId: UUID;
  purchaseId: UUID | null;
  amountKes: Money;
  paymentMethod: PaymentMethod;
  status: PaymentState;
  mpesaTransactionId: UUID | null;
  createdBy: UUID;
  idempotencyKey: string;
  createdAt: ISODateString;
}

export interface SalePayment {
  id: UUID;
  tenantId: UUID;
  buyerId: UUID;
  saleId: UUID | null;
  amountKes: Money;
  paymentMethod: PaymentMethod;
  status: PaymentState;
  mpesaTransactionId: UUID | null;
  createdBy: UUID;
  idempotencyKey: string;
  createdAt: ISODateString;
}

export interface PaymentAllocation {
  id: UUID;
  tenantId: UUID;
  paymentType: PaymentAllocationPaymentType;
  paymentId: UUID;
  targetType: PaymentAllocationTargetType;
  targetId: UUID;
  allocatedAmountKes: Money;
  createdAt: ISODateString;
}

export interface StockBalance {
  tenantId: UUID;
  categoryId: UUID;
  yardId: UUID | null;
  weightKg: WeightKg;
  avgCostPerKg: Money;
  version: number;
  updatedAt: ISODateString;
}

export interface StockMovement {
  id: UUID;
  tenantId: UUID;
  categoryId: UUID;
  movementType: MovementType;
  weightDeltaKg: WeightKg;
  referenceType: string;
  referenceId: UUID;
  runningBalanceKg: WeightKg;
  createdBy: UUID;
  createdAt: ISODateString;
}

export interface Correction {
  id: UUID;
  tenantId: UUID;
  correctableType: CorrectableType;
  correctableId: UUID;
  categoryId: UUID;
  weightDeltaKg: WeightKg;
  valueDeltaKes: Money;
  reason: string;
  createdBy: UUID;
  createdAt: ISODateString;
}

export interface StockAdjustment {
  id: UUID;
  tenantId: UUID;
  categoryId: UUID;
  weightDeltaKg: WeightKg;
  reason: string;
  createdBy: UUID;
  createdAt: ISODateString;
}

export interface MpesaTransaction {
  id: UUID;
  tenantId: UUID;
  direction: MpesaDirection;
  amountKes: Money;
  phone: string;
  status: MpesaStatus;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  mpesaReceiptNumber: string | null;
  accountReference: string;
  rawRequest: Record<string, unknown> | null;
  rawCallback: Record<string, unknown> | null;
  linkedPaymentType: PaymentAllocationPaymentType | null;
  linkedPaymentId: UUID | null;
  createdAt: ISODateString;
  confirmedAt: ISODateString | null;
}

export interface Receipt {
  id: UUID;
  tenantId: UUID;
  receiptNumber: string;
  receiptType: ReceiptType;
  referenceType: string;
  referenceId: UUID;
  payloadJson: Record<string, unknown>;
  printCount: number;
  createdAt: ISODateString;
  printedAt: ISODateString | null;
}

export interface Subscription {
  tenantId: UUID;
  planTier: string;
  status: string;
  currentPeriodStart: ISODateString;
  currentPeriodEnd: ISODateString;
  graceEndsAt: ISODateString | null;
}

export interface BillingCycle {
  id: UUID;
  tenantId: UUID;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  intakeKg: WeightKg;
  tierName: string;
  amountKes: Money;
  status: BillingCycleStatus;
}

export interface Invoice {
  id: UUID;
  tenantId: UUID;
  billingCycleId: UUID;
  amountKes: Money;
  status: string;
  dueDate: ISODateString;
  paidAt: ISODateString | null;
  mpesaTransactionId: UUID | null;
}

export interface LedgerEvent {
  id: UUID;
  tenantId: UUID;
  eventType: string;
  payload: Record<string, unknown>;
  actorId: UUID | null;
  referenceType: string | null;
  referenceId: UUID | null;
  createdAt: ISODateString;
}

export interface AuditLog {
  id: UUID;
  tenantId: UUID | null;
  userId: UUID | null;
  action: string;
  entityType: string;
  entityId: UUID | null;
  metadataJson: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: ISODateString;
}
