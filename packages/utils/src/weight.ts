import type { WeightKg } from '@yardflow/types';

/** Round to 3dp (DB NUMERIC(12,3)). */
export const roundWeight = (value: number): WeightKg =>
  Math.round((value + Number.EPSILON) * 1000) / 1000;

export const isPositiveWeight = (value: number): boolean => Number.isFinite(value) && value > 0;

/** Stock must never go negative (SYSTEM_RULES Sec 4/11). */
export const wouldStayNonNegative = (currentKg: number, deltaKg: number): boolean =>
  roundWeight(currentKg + deltaKg) >= 0;

export const formatKg = (value: number, decimals = 3): string =>
  `${roundWeight(value).toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })} kg`;
