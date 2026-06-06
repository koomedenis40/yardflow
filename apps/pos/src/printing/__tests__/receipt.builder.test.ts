import { buildPurchaseReceipt, buildSaleReceipt, buildSupplierPaymentReceipt, buildBuyerPaymentReceipt } from '../receipt.builder';
import type { Purchase, Sale, SupplierPayment, BuyerPayment } from '../../types/api';

const CASHIER = 'Test Cashier';
const SLUG = 'demo-yard';

const purchase: Purchase = {
  id: 'aabbccdd-1234-5678-9012-aabbccddeeff',
  weightKg: '100.5',
  pricePerKgKes: '50',
  totalValueKes: '5025',
  paidAmountKes: '5000',
  paymentStatus: 'partial',
  paymentMethod: 'cash',
  idempotencyKey: 'key-1',
  createdAt: '2026-06-06T14:30:00.000Z',
  supplier: { id: 'sup1', name: 'ABC Traders' },
  category: { id: 'cat1', name: 'Steel Scrap' },
};

const sale: Sale = {
  id: 'eeff0011-2233-4455-6677-8899aabbccdd',
  weightKg: '50',
  pricePerKgKes: '80',
  totalValueKes: '4000',
  paidAmountKes: '4000',
  paymentStatus: 'paid',
  paymentMethod: 'bank',
  idempotencyKey: 'key-2',
  createdAt: '2026-06-06T15:00:00.000Z',
  buyer: { id: 'buy1', name: 'XYZ Metal' },
  category: { id: 'cat1', name: 'Steel Scrap' },
};

const supplierPayment: SupplierPayment = {
  id: 'paysupp-1234',
  amountKes: '5000',
  paymentMethod: 'cash',
  createdAt: '2026-06-06T16:00:00.000Z',
  supplier: { id: 'sup1', name: 'ABC Traders' },
  allocations: [
    { id: 'alloc1', allocatedAmountKes: '5000', targetType: 'purchase', purchaseId: 'p1' },
  ],
  creditAppliedKes: '0',
  remainderToCreditKes: '0',
};

const buyerPayment: BuyerPayment = {
  id: 'paybuy-5678',
  amountKes: '4000',
  paymentMethod: 'mobile_money_manual',
  createdAt: '2026-06-06T17:00:00.000Z',
  buyer: { id: 'buy1', name: 'XYZ Metal' },
  allocations: [
    { id: 'alloc2', allocatedAmountKes: '4000', targetType: 'sale', saleId: 's1' },
    { id: 'alloc3', allocatedAmountKes: '0', targetType: 'sale', saleId: 's2' },
  ],
};

describe('buildPurchaseReceipt', () => {
  const r = buildPurchaseReceipt(purchase, CASHIER, SLUG);

  it('sets correct type', () => expect(r.type).toBe('purchase'));
  it('formats yard name from slug', () => expect(r.yardName).toBe('Demo Yard'));
  it('generates short ref from id', () => expect(r.referenceId).toMatch(/^#[A-Z0-9]{8}$/));
  it('includes supplier name', () => expect(r.partyName).toBe('ABC Traders'));
  it('sets partyLabel to Supplier', () => expect(r.partyLabel).toBe('Supplier'));
  it('includes category and weight lines', () => {
    expect(r.lines.some((l) => l.label === 'Category')).toBe(true);
    expect(r.lines.some((l) => l.label === 'Weight')).toBe(true);
  });
  it('sets balance owed for partial payment', () => {
    expect(r.balanceLabel).toBe('Balance Owed');
    expect(r.balanceValue).toBeDefined();
  });
  it('formats payment method', () => expect(r.methodValue).toBe('Cash'));
  it('formats status', () => expect(r.statusValue).toBe('Partial'));
  it('sets cashier name', () => expect(r.cashierName).toBe(CASHIER));
});

describe('buildSaleReceipt', () => {
  const r = buildSaleReceipt(sale, CASHIER, SLUG);

  it('sets correct type', () => expect(r.type).toBe('sale'));
  it('includes buyer name', () => expect(r.partyName).toBe('XYZ Metal'));
  it('sets partyLabel to Buyer', () => expect(r.partyLabel).toBe('Buyer'));
  it('formats bank method', () => expect(r.methodValue).toBe('Bank'));
  it('has no balance for fully paid sale', () => expect(r.balanceLabel).toBeUndefined());
});

describe('buildSupplierPaymentReceipt', () => {
  const r = buildSupplierPaymentReceipt(supplierPayment, CASHIER, SLUG);

  it('sets correct type', () => expect(r.type).toBe('supplier_payment'));
  it('counts allocations', () => {
    const allocLine = r.lines.find((l) => l.label === 'Invoices cleared');
    expect(allocLine?.value).toBe('1');
  });
  it('uses Amount Paid label', () => expect(r.totalLabel).toBe('Amount Paid'));
});

describe('buildBuyerPaymentReceipt', () => {
  const r = buildBuyerPaymentReceipt(buyerPayment, CASHIER, SLUG);

  it('sets correct type', () => expect(r.type).toBe('buyer_payment'));
  it('counts allocations', () => {
    const allocLine = r.lines.find((l) => l.label === 'Invoices cleared');
    expect(allocLine?.value).toBe('2');
  });
  it('formats mobile money method', () => expect(r.methodValue).toBe('Mobile money (manual)'));
  it('uses Amount Received label', () => expect(r.totalLabel).toBe('Amount Received'));
});
