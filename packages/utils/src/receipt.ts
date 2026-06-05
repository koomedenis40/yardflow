import type { ReceiptType } from '@yardflow/types';

// Receipt number format: {PREFIX}-{TYPE}-{YYYYMM}-{SEQ} (SYSTEM_RULES Sec 19).
const RECEIPT_TYPE_CODE: Record<ReceiptType, string> = {
  purchase: 'PUR',
  supplier_payment: 'SPY',
  sale: 'SAL',
  buyer_payment: 'BPY',
  correction: 'COR',
  adjustment: 'ADJ',
};

export const receiptTypeCode = (type: ReceiptType): string => RECEIPT_TYPE_CODE[type];

export const formatReceiptNumber = (
  tenantPrefix: string,
  type: ReceiptType,
  yearMonth: string,
  sequence: number,
  sequencePad = 5,
): string => {
  const seq = String(sequence).padStart(sequencePad, '0');
  return `${tenantPrefix}-${RECEIPT_TYPE_CODE[type]}-${yearMonth}-${seq}`;
};
