import { z } from 'zod';
import { idempotencyKeySchema, positiveMoneySchema, positiveWeightSchema, moneySchema, uuidSchema } from './common';
import { paymentMethodSchema } from './enums';

// total_value_kes and supplier balance deltas are computed server-side from these inputs.
export const createPurchaseSchema = z
  .object({
    supplierId: uuidSchema,
    categoryId: uuidSchema,
    weightKg: positiveWeightSchema,
    buyingPricePerKg: positiveMoneySchema,
    amountPaidAtCreationKes: moneySchema.default(0),
    paymentMethod: paymentMethodSchema.optional(),
    notes: z.string().trim().max(500).optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .refine((v) => v.amountPaidAtCreationKes === 0 || v.paymentMethod !== undefined, {
    message: 'paymentMethod is required when an amount is paid at creation',
    path: ['paymentMethod'],
  });
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
