// API response contracts mirroring the YardFlow backend

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type PaymentMethod = 'cash' | 'bank' | 'mobile_money_manual' | 'other_manual';

export interface UserProfile {
  userId: string;
  fullName: string;
  email: string | null;
  tenantId?: string;
  tenantSlug?: string;
  role?: string;
  permissions: string[];
  isPlatformAdmin: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: UserProfile;
}

// Inventory
export interface Category {
  id: string;
  name: string;
  defaultBuyingPriceKes: string;
  defaultSellingPriceKes: string;
  isActive: boolean;
}

export interface InventoryItem {
  id: string;
  categoryId: string;
  weightKg: string;
  avgCostKes: string;
  category: Category | null;
}

export interface StockMovement {
  id: string;
  type: string;
  weightKgDelta: string;
  createdAt: string;
}

// Parties
export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  balanceKes: string;
  creditBalanceKes: string;
  isActive: boolean;
  createdAt: string;
}

export interface Buyer {
  id: string;
  name: string;
  phone: string | null;
  balanceKes: string;
  isActive: boolean;
  createdAt: string;
}

// Ledger
export interface Purchase {
  id: string;
  weightKg: string;
  pricePerKgKes: string;
  totalValueKes: string;
  paidAmountKes: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

export interface Sale {
  id: string;
  weightKg: string;
  pricePerKgKes: string;
  totalValueKes: string;
  paidAmountKes: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  createdAt: string;
  buyer: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

// Payments
export interface PaymentAllocation {
  id: string;
  allocatedAmountKes: string;
  targetType: string;
  purchaseId?: string;
  saleId?: string;
}

export interface SupplierPayment {
  id: string;
  amountKes: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  allocations: PaymentAllocation[];
  creditAppliedKes?: string;
  remainderToCreditKes?: string;
}

export interface BuyerPayment {
  id: string;
  amountKes: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  buyer: { id: string; name: string } | null;
  allocations: PaymentAllocation[];
}

// Balances
export interface BalanceSummary {
  supplierOwedKes: number;
  supplierCreditKes: number;
  buyerReceivableKes: number;
}

export interface SupplierBalance {
  id: string;
  name: string;
  balanceKes: string;
  creditBalanceKes: string;
  updatedAt: string;
}
