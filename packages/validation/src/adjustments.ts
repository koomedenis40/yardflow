import { z } from 'zod';
import { idempotencyKeySchema, reasonSchema, uuidSchema, weightSchema } from './common';

// Owner-only physical-count alignment. Signed, non-zero delta; never touches party balances.
export const createStockAdjustmentSchema = z.object({
  categoryId: uuidSchema,
  weightDeltaKg: weightSchema.refine((v) => v !== 0, { message: 'Adjustment delta cannot be zero' }),
  reason: reasonSchema,
  idempotencyKey: idempotencyKeySchema,
});
export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;
