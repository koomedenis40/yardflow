export type ReceiptType = 'purchase' | 'sale' | 'supplier_payment' | 'buyer_payment';

export interface ReceiptLine {
  label: string;
  value: string;
  bold?: boolean;
}

/** All data needed to render or print a receipt. No calculations — values come from API responses. */
export interface ReceiptData {
  type: ReceiptType;
  yardName: string;
  title: string;
  referenceId: string; // e.g. "#A1B2C3D4"
  dateTime: string;    // e.g. "06 Jun 2026 14:30"
  cashierName: string;
  partyLabel: string;  // "Supplier" or "Buyer"
  partyName: string;
  lines: ReceiptLine[];    // middle rows (category, weight, unit price, etc.)
  totalLabel: string;
  totalValue: string;
  paidLabel?: string;
  paidValue?: string;
  methodValue: string;
  statusValue?: string;
  balanceLabel?: string;
  balanceValue?: string;
  footer: string;
}
