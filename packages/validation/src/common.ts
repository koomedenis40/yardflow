import { z } from 'zod';

/** True when `value` has at most `dp` decimal places (tolerant of float error). */
const hasMaxDecimals = (value: number, dp: number): boolean => {
  const factor = 10 ** dp;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
};

export const uuidSchema = z.string().uuid();

/** All ledger mutation endpoints require a client-generated idempotency key (SYSTEM_RULES Sec 24). */
export const idempotencyKeySchema = z.string().uuid();

/** Money: KES, NUMERIC(14,2). Non-negative. */
export const moneySchema = z
  .number()
  .finite()
  .nonnegative()
  .refine((v) => hasMaxDecimals(v, 2), { message: 'Money supports at most 2 decimal places' });

export const positiveMoneySchema = moneySchema.refine((v) => v > 0, {
  message: 'Amount must be greater than 0',
});

/** Signed money for value deltas in corrections (may be negative). */
export const signedMoneySchema = z
  .number()
  .finite()
  .refine((v) => hasMaxDecimals(v, 2), { message: 'Money supports at most 2 decimal places' });

/** Weight: kg, NUMERIC(12,3). Signed allowed (corrections/adjustments use signed delta). */
export const weightSchema = z
  .number()
  .finite()
  .refine((v) => hasMaxDecimals(v, 3), { message: 'Weight supports at most 3 decimal places' });

export const positiveWeightSchema = weightSchema.refine((v) => v > 0, {
  message: 'Weight must be greater than 0',
});

export const reasonSchema = z.string().trim().min(3, 'A reason is required').max(500);
