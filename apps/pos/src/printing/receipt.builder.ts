/**
 * Maps API responses to ReceiptData.
 * No business logic — values come directly from API fields.
 * Display-only balance arithmetic is clearly labelled.
 */

import type { Purchase, Sale, SupplierPayment, BuyerPayment } from '../types/api';
import { formatMoney, formatWeight, formatMethod, formatDateTime } from '../lib/format';
import type { ReceiptData } from './receipt.types';

const FOOTER = 'Thank you for your business!\nYardFlow POS';

function shortRef(id: string): string {
  return '#' + id.slice(-8).toUpperCase();
}

function formatYardName(slug: string | undefined): string {
  if (!slug) return 'YardFlow';
  return slug
    .split('-')
    .map((w) => (w[0] ?? '').toUpperCase() + w.slice(1))
    .join(' ');
}

function displayBalance(total: string, paid: string): string {
  const bal = Number(total) - Number(paid);
  return formatMoney(bal < 0 ? 0 : bal);
}

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildPurchaseReceipt(
  p: Purchase,
  cashierName: string,
  tenantSlug: string | undefined,
): ReceiptData {
  const paid = Number(p.paidAmountKes);
  const total = Number(p.totalValueKes);
  const owes = total - paid;

  return {
    type: 'purchase',
    yardName: formatYardName(tenantSlug),
    title: 'PURCHASE RECEIPT',
    referenceId: shortRef(p.id),
    dateTime: formatDateTime(p.createdAt),
    cashierName,
    partyLabel: 'Supplier',
    partyName: p.supplier?.name ?? '—',
    lines: [
      { label: 'Category', value: p.category?.name ?? '—' },
      { label: 'Weight', value: formatWeight(p.weightKg) },
      { label: 'Unit Price', value: formatMoney(p.pricePerKgKes) + '/kg' },
    ],
    totalLabel: 'Total Value',
    totalValue: formatMoney(p.totalValueKes),
    paidLabel: 'Paid Now',
    paidValue: formatMoney(p.paidAmountKes),
    methodValue: formatMethod(p.paymentMethod),
    statusValue: p.paymentStatus.charAt(0).toUpperCase() + p.paymentStatus.slice(1),
    ...(owes > 0 && { balanceLabel: 'Balance Owed', balanceValue: displayBalance(p.totalValueKes, p.paidAmountKes) }),
    footer: FOOTER,
  };
}

export function buildSaleReceipt(
  s: Sale,
  cashierName: string,
  tenantSlug: string | undefined,
): ReceiptData {
  const paid = Number(s.paidAmountKes);
  const total = Number(s.totalValueKes);
  const owes = total - paid;

  return {
    type: 'sale',
    yardName: formatYardName(tenantSlug),
    title: 'SALE RECEIPT',
    referenceId: shortRef(s.id),
    dateTime: formatDateTime(s.createdAt),
    cashierName,
    partyLabel: 'Buyer',
    partyName: s.buyer?.name ?? '—',
    lines: [
      { label: 'Category', value: s.category?.name ?? '—' },
      { label: 'Weight', value: formatWeight(s.weightKg) },
      { label: 'Unit Price', value: formatMoney(s.pricePerKgKes) + '/kg' },
    ],
    totalLabel: 'Total Value',
    totalValue: formatMoney(s.totalValueKes),
    paidLabel: 'Received Now',
    paidValue: formatMoney(s.paidAmountKes),
    methodValue: formatMethod(s.paymentMethod),
    statusValue: s.paymentStatus.charAt(0).toUpperCase() + s.paymentStatus.slice(1),
    ...(owes > 0 && { balanceLabel: 'Receivable', balanceValue: displayBalance(s.totalValueKes, s.paidAmountKes) }),
    footer: FOOTER,
  };
}

export function buildSupplierPaymentReceipt(
  pay: SupplierPayment,
  cashierName: string,
  tenantSlug: string | undefined,
): ReceiptData {
  const allocCount = pay.allocations?.length ?? 0;
  const creditApplied = Number(pay.creditAppliedKes ?? 0);
  const remainder = Number(pay.remainderToCreditKes ?? 0);

  const lines: ReceiptData['lines'] = [
    { label: 'Invoices cleared', value: String(allocCount) },
  ];
  if (creditApplied > 0) {
    lines.push({ label: 'Credit applied', value: formatMoney(creditApplied) });
  }
  if (remainder > 0) {
    lines.push({ label: 'Added to credit', value: formatMoney(remainder) });
  }

  return {
    type: 'supplier_payment',
    yardName: formatYardName(tenantSlug),
    title: 'SUPPLIER PAYMENT',
    referenceId: shortRef(pay.id),
    dateTime: formatDateTime(pay.createdAt),
    cashierName,
    partyLabel: 'Supplier',
    partyName: pay.supplier?.name ?? '—',
    lines,
    totalLabel: 'Amount Paid',
    totalValue: formatMoney(pay.amountKes),
    methodValue: formatMethod(pay.paymentMethod),
    footer: FOOTER,
  };
}

export function buildBuyerPaymentReceipt(
  pay: BuyerPayment,
  cashierName: string,
  tenantSlug: string | undefined,
): ReceiptData {
  const allocCount = pay.allocations?.length ?? 0;

  return {
    type: 'buyer_payment',
    yardName: formatYardName(tenantSlug),
    title: 'BUYER PAYMENT',
    referenceId: shortRef(pay.id),
    dateTime: formatDateTime(pay.createdAt),
    cashierName,
    partyLabel: 'Buyer',
    partyName: pay.buyer?.name ?? '—',
    lines: [{ label: 'Invoices cleared', value: String(allocCount) }],
    totalLabel: 'Amount Received',
    totalValue: formatMoney(pay.amountKes),
    methodValue: formatMethod(pay.paymentMethod),
    footer: FOOTER,
  };
}

// ─── Partial builders for RecentPaymentEntry (detail screen) ─────────────────
// These entries lack allocation details — that's expected from the list endpoint.

export function buildSupplierPaymentReceiptFromEntry(
  entry: { id: string; amountKes: string; paymentMethod: string; createdAt: string },
  supplierName: string,
  cashierName: string,
  tenantSlug: string | undefined,
): ReceiptData {
  return {
    type: 'supplier_payment',
    yardName: formatYardName(tenantSlug),
    title: 'SUPPLIER PAYMENT',
    referenceId: shortRef(entry.id),
    dateTime: formatDateTime(entry.createdAt),
    cashierName,
    partyLabel: 'Supplier',
    partyName: supplierName,
    lines: [],
    totalLabel: 'Amount Paid',
    totalValue: formatMoney(entry.amountKes),
    methodValue: formatMethod(entry.paymentMethod),
    footer: FOOTER,
  };
}

export function buildBuyerPaymentReceiptFromEntry(
  entry: { id: string; amountKes: string; paymentMethod: string; createdAt: string },
  buyerName: string,
  cashierName: string,
  tenantSlug: string | undefined,
): ReceiptData {
  return {
    type: 'buyer_payment',
    yardName: formatYardName(tenantSlug),
    title: 'PAYMENT RECEIVED',
    referenceId: shortRef(entry.id),
    dateTime: formatDateTime(entry.createdAt),
    cashierName,
    partyLabel: 'Buyer',
    partyName: buyerName,
    lines: [],
    totalLabel: 'Amount Received',
    totalValue: formatMoney(entry.amountKes),
    methodValue: formatMethod(entry.paymentMethod),
    footer: FOOTER,
  };
}
