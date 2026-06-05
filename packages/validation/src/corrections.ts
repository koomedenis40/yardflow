import { z } from 'zod';
import { reasonSchema, signedMoneySchema, uuidSchema, weightSchema } from './common';

const hasDelta = (v: { weightDeltaKg?: number; valueDeltaKes?: number }): boolean =>
  v.weightDeltaKg !== undefined || v.valueDeltaKes !== undefined;

export const createCorrectionSchema = z
  .object({
    targetType: z.enum(['PURCHASE', 'SALE']),
    targetId: uuidSchema,
    weightDeltaKg: weightSchema.optional(),
    valueDeltaKes: signedMoneySchema.optional(),
    reason: reasonSchema,
  })
  .refine(hasDelta, { message: 'Provide a weight and/or value delta', path: ['weightDeltaKg'] });
export type CreateCorrectionInput = z.infer<typeof createCorrectionSchema>;
