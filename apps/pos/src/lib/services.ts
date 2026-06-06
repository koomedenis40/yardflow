import { apiFetch } from './api';
import type {
  BalanceSummary,
  Buyer,
  BuyerPayment,
  Category,
  InventoryItem,
  Purchase,
  Sale,
  Supplier,
  SupplierBalance,
  SupplierPayment,
  UserProfile,
} from '../types/api';

// Auth
export const getMe = (token: string) =>
  apiFetch<UserProfile>('/auth/me', { token });

// Dashboard composite
export const getBalanceSummary = (token: string) =>
  apiFetch<BalanceSummary>('/balances/summary', { token });

export const getInventory = (token: string) =>
  apiFetch<InventoryItem[]>('/inventory', { token });

export const getPurchases = (token: string) =>
  apiFetch<Purchase[]>('/purchases', { token });

export const getSales = (token: string) =>
  apiFetch<Sale[]>('/sales', { token });

export const getSupplierPayments = (token: string) =>
  apiFetch<SupplierPayment[]>('/supplier-payments', { token });

export const getBuyerPayments = (token: string) =>
  apiFetch<BuyerPayment[]>('/buyer-payments', { token });

// Parties
export const getSuppliers = (token: string) =>
  apiFetch<Supplier[]>('/suppliers', { token });

export const getSupplier = (token: string, id: string) =>
  apiFetch<Supplier>(`/suppliers/${id}`, { token });

export const createSupplier = (
  token: string,
  data: { name: string; phone?: string },
) =>
  apiFetch<Supplier>('/suppliers', {
    token,
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getBuyers = (token: string) =>
  apiFetch<Buyer[]>('/buyers', { token });

export const getBuyer = (token: string, id: string) =>
  apiFetch<Buyer>(`/buyers/${id}`, { token });

export const createBuyer = (
  token: string,
  data: { name: string; phone?: string },
) =>
  apiFetch<Buyer>('/buyers', {
    token,
    method: 'POST',
    body: JSON.stringify(data),
  });

// Categories & Inventory
export const getCategories = (token: string) =>
  apiFetch<Category[]>('/categories', { token });

export const getSupplierBalances = (token: string) =>
  apiFetch<SupplierBalance[]>('/balances/suppliers', { token });

// Ledger mutations
export interface CreatePurchaseInput {
  supplierId: string;
  categoryId: string;
  weightKg: number;
  pricePerKgKes: number;
  paidAmountKes: number;
  paymentMethod: string;
  idempotencyKey: string;
}

export const createPurchase = (token: string, data: CreatePurchaseInput) =>
  apiFetch<Purchase>('/purchases', {
    token,
    method: 'POST',
    body: JSON.stringify(data),
  });

export interface CreateSaleInput {
  buyerId: string;
  categoryId: string;
  weightKg: number;
  pricePerKgKes: number;
  paidAmountKes: number;
  paymentMethod: string;
  idempotencyKey: string;
}

export const createSale = (token: string, data: CreateSaleInput) =>
  apiFetch<Sale>('/sales', {
    token,
    method: 'POST',
    body: JSON.stringify(data),
  });

// Payment mutations
export interface CreateSupplierPaymentInput {
  supplierId: string;
  amountKes: number;
  paymentMethod: string;
  idempotencyKey: string;
}

export const createSupplierPayment = (
  token: string,
  data: CreateSupplierPaymentInput,
) =>
  apiFetch<SupplierPayment>('/supplier-payments', {
    token,
    method: 'POST',
    body: JSON.stringify(data),
  });

export interface CreateBuyerPaymentInput {
  buyerId: string;
  amountKes: number;
  paymentMethod: string;
  idempotencyKey: string;
}

export const createBuyerPayment = (
  token: string,
  data: CreateBuyerPaymentInput,
) =>
  apiFetch<BuyerPayment>('/buyer-payments', {
    token,
    method: 'POST',
    body: JSON.stringify(data),
  });
