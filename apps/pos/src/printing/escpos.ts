/**
 * ESC/POS byte formatter for 58mm (32-col) and 80mm (48-col) thermal printers.
 * Pure TypeScript — no React Native dependency.
 */

import type { ReceiptData } from './receipt.types';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const COLS_58MM = 32;
export const COLS_80MM = 48;

/** Fluent ESC/POS byte builder. */
export class EscPosDoc {
  private buf: number[] = [];

  /** ESC @ — reset printer to default state. */
  init(): this {
    this.buf.push(ESC, 0x40);
    return this;
  }

  /** ESC a n — 0 left, 1 center, 2 right. */
  align(a: 'left' | 'center' | 'right'): this {
    const n = a === 'left' ? 0 : a === 'center' ? 1 : 2;
    this.buf.push(ESC, 0x61, n);
    return this;
  }

  /** ESC E n — 1 bold on, 0 bold off. */
  bold(on: boolean): this {
    this.buf.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  /** Write ASCII text (0x00–0x7e safe for all printers). */
  text(s: string): this {
    for (let i = 0; i < s.length; i++) {
      this.buf.push(s.charCodeAt(i) & 0x7f);
    }
    return this;
  }

  /** Line feed (n times). */
  feed(n = 1): this {
    for (let i = 0; i < n; i++) this.buf.push(LF);
    return this;
  }

  /** Print a full-width divider line. */
  divider(char = '-', cols = COLS_58MM): this {
    return this.align('left').text(char.repeat(cols)).feed();
  }

  /** GS V 66 0 — partial cut with feed. */
  cut(): this {
    this.buf.push(GS, 0x56, 0x42, 0x00);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(s: string, width: number): string {
  return s.length >= width ? s.substring(0, width) : s + ' '.repeat(width - s.length);
}

function rpad(s: string, width: number): string {
  return s.length >= width ? s.substring(0, width) : ' '.repeat(width - s.length) + s;
}

/** Left-label + right-value row fitting within `cols` chars. */
function row(label: string, value: string, cols: number): string {
  const gap = cols - label.length - value.length;
  if (gap < 1) {
    const maxLabel = cols - value.length - 1;
    return label.substring(0, maxLabel) + ' ' + value;
  }
  return label + ' '.repeat(gap) + value;
}

function center(s: string, cols: number): string {
  const pad = Math.max(0, Math.floor((cols - s.length) / 2));
  return ' '.repeat(pad) + s;
}

// ─── Receipt → ESC/POS bytes ─────────────────────────────────────────────────

export function buildReceiptBytes(receipt: ReceiptData, cols: number = COLS_58MM): Uint8Array {
  const div = '-'.repeat(cols);
  const eq = '='.repeat(cols);
  const doc = new EscPosDoc().init();

  // Header
  doc.align('center')
    .bold(true).text(receipt.yardName).feed()
    .bold(false).text(receipt.title).feed()
    .align('left').text(div).feed();

  // Meta
  doc.text(row('Date:', receipt.dateTime, cols)).feed()
    .text(row('Ref:', receipt.referenceId, cols)).feed()
    .text(row('Cashier:', receipt.cashierName, cols)).feed()
    .text(div).feed();

  // Party
  doc.text(row(receipt.partyLabel + ':', receipt.partyName, cols)).feed();

  // Detail lines
  for (const line of receipt.lines) {
    if (line.bold) doc.bold(true);
    doc.text(row(line.label + ':', line.value, cols)).feed();
    if (line.bold) doc.bold(false);
  }

  doc.text(div).feed();

  // Totals
  doc.bold(true)
    .text(row(receipt.totalLabel + ':', receipt.totalValue, cols)).feed()
    .bold(false);

  if (receipt.paidLabel && receipt.paidValue) {
    doc.text(row(receipt.paidLabel + ':', receipt.paidValue, cols)).feed();
  }

  doc.text(row('Method:', receipt.methodValue, cols)).feed();

  if (receipt.statusValue) {
    doc.text(row('Status:', receipt.statusValue, cols)).feed();
  }

  if (receipt.balanceLabel && receipt.balanceValue) {
    doc.text(div).feed()
      .bold(true)
      .text(row(receipt.balanceLabel + ':', receipt.balanceValue, cols)).feed()
      .bold(false);
  }

  // Footer
  doc.text(div).feed()
    .align('center')
    .text(receipt.footer).feed()
    .feed(2)
    .cut();

  return doc.build();
}
