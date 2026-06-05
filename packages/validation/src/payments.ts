import { z } from 'zod';
import { idempotencyKeySchema, positiveMoneySchema, uuidSchema } from './common';
import { paymentMethodSchema } from './enums';

// Supplier payment: optional purchaseId targets a specific purchase; otherwise FIFO + credit pool.
export const createSupplierPaymentSchema = z.object({
  supplierId: uuidSchema,
  amountKes: positiveMoneySchema,
  paymentMethod: paymentMethodSchema,
  purchaseId: uuidSchema.optional(),
  idempotencyKey: idempotencyKeySchema,
});
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

// Buyer payment: optional saleId targets a specific sale; otherwise FIFO over unpaid sales.
export const createBuyerPaymentSchema = z.object({
  buyerId: uuidSchema,
  amountKes: positiveMoneySchema,
  paymentMethod: paymentMethodSchema,
  saleId: uuidSchema.optional(),
  idempotencyKey: idempotencyKeySchema,
});
export type CreateBuyerPaymentInput = z.infer<typeof createBuyerPaymentSchema>;
