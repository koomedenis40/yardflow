import { z } from 'zod';
import { idempotencyKeySchema, positiveMoneySchema, positiveWeightSchema, uuidSchema } from './common';

export const createSaleSchema = z.object({
  buyerId: uuidSchema,
  categoryId: uuidSchema,
  weightKg: positiveWeightSchema,
  pricePerKg: positiveMoneySchema,
  idempotencyKey: idempotencyKeySchema,
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
