import { EscPosDoc, buildReceiptBytes, COLS_58MM } from '../escpos';
import type { ReceiptData } from '../receipt.types';

describe('EscPosDoc', () => {
  it('produces a non-empty Uint8Array', () => {
    const doc = new EscPosDoc().init().align('center').text('Hello').feed().cut();
    const bytes = doc.build();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('init emits ESC @', () => {
    const doc = new EscPosDoc().init();
    const bytes = doc.build();
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it('align center emits ESC a 1', () => {
    const doc = new EscPosDoc().align('center');
    const bytes = doc.build();
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x61);
    expect(bytes[2]).toBe(1);
  });

  it('bold on emits ESC E 1', () => {
    const doc = new EscPosDoc().bold(true);
    const b = doc.build();
    expect(b[0]).toBe(0x1b);
    expect(b[1]).toBe(0x45);
    expect(b[2]).toBe(1);
  });

  it('feed emits LF', () => {
    const doc = new EscPosDoc().feed();
    expect(doc.build()[0]).toBe(0x0a);
  });

  it('cut emits GS V 66 0', () => {
    const doc = new EscPosDoc().cut();
    const b = doc.build();
    expect(b[0]).toBe(0x1d);
    expect(b[1]).toBe(0x56);
    expect(b[2]).toBe(0x42);
    expect(b[3]).toBe(0x00);
  });

  it('text emits correct ASCII bytes', () => {
    const doc = new EscPosDoc().text('AB');
    const b = doc.build();
    expect(b[0]).toBe(65); // 'A'
    expect(b[1]).toBe(66); // 'B'
  });

  it('divider fills the column width', () => {
    const doc = new EscPosDoc().divider('-', COLS_58MM);
    const bytes = doc.build();
    // ESC a 0 (3 bytes) + 32 dashes + LF
    expect(bytes.length).toBe(3 + COLS_58MM + 1);
  });
});

describe('buildReceiptBytes', () => {
  const receipt: ReceiptData = {
    type: 'purchase',
    yardName: 'Demo Yard',
    title: 'PURCHASE RECEIPT',
    referenceId: '#AB123456',
    dateTime: '06 Jun 2026 14:30',
    cashierName: 'John Doe',
    partyLabel: 'Supplier',
    partyName: 'ABC Traders',
    lines: [
      { label: 'Category', value: 'Steel Scrap' },
      { label: 'Weight', value: '100.5 kg' },
      { label: 'Unit Price', value: 'KES 50/kg' },
    ],
    totalLabel: 'Total Value',
    totalValue: 'KES 5,025',
    paidLabel: 'Paid Now',
    paidValue: 'KES 5,000',
    methodValue: 'Cash',
    statusValue: 'Partial',
    balanceLabel: 'Balance Owed',
    balanceValue: 'KES 25',
    footer: 'Thank you!\nYardFlow POS',
  };

  it('returns a non-empty Uint8Array', () => {
    const bytes = buildReceiptBytes(receipt);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(50);
  });

  it('ends with a cut command', () => {
    const bytes = buildReceiptBytes(receipt);
    // Last 4 bytes: GS V 66 0
    const end = bytes.slice(-4);
    expect(end[0]).toBe(0x1d);
    expect(end[1]).toBe(0x56);
    expect(end[2]).toBe(0x42);
    expect(end[3]).toBe(0x00);
  });

  it('works without optional fields', () => {
    const minimal: ReceiptData = {
      type: 'supplier_payment',
      yardName: 'My Yard',
      title: 'SUPPLIER PAYMENT',
      referenceId: '#00000001',
      dateTime: '01 Jan 2026 09:00',
      cashierName: 'Admin',
      partyLabel: 'Supplier',
      partyName: 'Juma Traders',
      lines: [],
      totalLabel: 'Amount Paid',
      totalValue: 'KES 1,000',
      methodValue: 'Cash',
      footer: 'Thank you!',
    };
    expect(() => buildReceiptBytes(minimal)).not.toThrow();
  });
});
