import { z } from 'zod';
import { idempotencyKeySchema, positiveMoneySchema, positiveWeightSchema, uuidSchema } from './common';

export const createPurchaseSchema = z.object({
  supplierId: uuidSchema,
  categoryId: uuidSchema,
  weightKg: positiveWeightSchema,
  pricePerKg: positiveMoneySchema,
  idempotencyKey: idempotencyKeySchema,
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
