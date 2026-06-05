import { z } from 'zod';
import { idempotencyKeySchema, positiveMoneySchema, positiveWeightSchema, moneySchema, uuidSchema } from './common';
import { paymentMethodSchema } from './enums';

// Stock sufficiency and COGS are enforced/snapshotted server-side at commit time.
export const createSaleSchema = z
  .object({
    buyerId: uuidSchema,
    categoryId: uuidSchema,
    weightKg: positiveWeightSchema,
    sellingPricePerKg: positiveMoneySchema,
    amountReceivedAtCreationKes: moneySchema.default(0),
    paymentMethod: paymentMethodSchema.optional(),
    notes: z.string().trim().max(500).optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .refine((v) => v.amountReceivedAtCreationKes === 0 || v.paymentMethod !== undefined, {
    message: 'paymentMethod is required when an amount is received at creation',
    path: ['paymentMethod'],
  });
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
