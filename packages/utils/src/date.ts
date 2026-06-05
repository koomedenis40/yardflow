import type { ISODateString } from '@yardflow/types';

/** All timestamps stored UTC; displayed Africa/Nairobi (SYSTEM_RULES Sec 23). */
export const NAIROBI_TZ = 'Africa/Nairobi';

export const nowUtcIso = (): ISODateString => new Date().toISOString();

export const formatInNairobi = (
  iso: ISODateString | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string => {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-KE', { timeZone: NAIROBI_TZ, ...options }).format(date);
};

/** Billing-period key YYYYMM in tenant timezone. */
export const yearMonthInNairobi = (iso: ISODateString | Date = new Date()): string => {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NAIROBI_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  return `${year}${month}`;
};
