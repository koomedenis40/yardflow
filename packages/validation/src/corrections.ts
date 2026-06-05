import { z } from 'zod';
import { idempotencyKeySchema, reasonSchema, signedMoneySchema, uuidSchema, weightSchema } from './common';

// Corrections never mutate the original row; they record signed deltas with a mandatory reason.
const hasDelta = (v: { weightDeltaKg?: number; valueDeltaKes?: number }): boolean =>
  v.weightDeltaKg !== undefined || v.valueDeltaKes !== undefined;

export const createPurchaseCorrectionSchema = z
  .object({
    purchaseId: uuidSchema,
    weightDeltaKg: weightSchema.optional(),
    valueDeltaKes: signedMoneySchema.optional(),
    reason: reasonSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .refine(hasDelta, { message: 'Provide a weight and/or value delta', path: ['weightDeltaKg'] });
export type CreatePurchaseCorrectionInput = z.infer<typeof createPurchaseCorrectionSchema>;

export const createSaleCorrectionSchema = z
  .object({
    saleId: uuidSchema,
    weightDeltaKg: weightSchema.optional(),
    valueDeltaKes: signedMoneySchema.optional(),
    reason: reasonSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .refine(hasDelta, { message: 'Provide a weight and/or value delta', path: ['weightDeltaKg'] });
export type CreateSaleCorrectionInput = z.infer<typeof createSaleCorrectionSchema>;
