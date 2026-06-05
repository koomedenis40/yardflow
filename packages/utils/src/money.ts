import type { Money } from '@yardflow/types';

/** Round to 2dp, half-up (SYSTEM_RULES Sec 8). Use at line level. */
export const roundMoney = (value: number): Money =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const addMoney = (a: number, b: number): Money => roundMoney(a + b);
export const subtractMoney = (a: number, b: number): Money => roundMoney(a - b);

/** total_value_kes = weight_kg x price_per_kg. */
export const computeTotalValue = (weightKg: number, pricePerKg: number): Money =>
  roundMoney(weightKg * pricePerKg);

/** Party balance delta = total - amount settled at creation. */
export const computeBalanceDelta = (totalValueKes: number, settledKes: number): Money =>
  roundMoney(totalValueKes - settledKes);

export interface FormatKesOptions {
  decimals?: number;
  withSymbol?: boolean;
}

export const formatKes = (value: number, options: FormatKesOptions = {}): string => {
  const { decimals = 2, withSymbol = true } = options;
  const formatted = roundMoney(value).toLocaleString('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withSymbol ? `KES ${formatted}` : formatted;
};
