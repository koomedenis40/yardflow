/**
 * Normalizes a Kenyan phone number to E.164 format (+254XXXXXXXXX).
 * Accepted inputs: 07XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX
 */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('07') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }
  if (digits.startsWith('7') && digits.length === 9) {
    return `+254${digits}`;
  }

  throw new Error(`Invalid Kenyan phone number: ${raw}`);
}

/** Strips the leading + for Daraja API fields that expect numeric-only strings */
export function toSafaricomPhone(normalized: string): string {
  return normalized.startsWith('+') ? normalized.slice(1) : normalized;
}
