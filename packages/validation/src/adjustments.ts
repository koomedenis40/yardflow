import { z } from 'zod';
import { reasonSchema, uuidSchema, weightSchema } from './common';

export const createStockAdjustmentSchema = z.object({
  categoryId: uuidSchema,
  weightDeltaKg: weightSchema.refine((v) => v !== 0, { message: 'Adjustment delta cannot be zero' }),
  reason: reasonSchema,
});
export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;
