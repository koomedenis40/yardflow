import { z } from 'zod';

export const stkPushSchema = z.object({
  buyerId: z.string().uuid(),
  amountKes: z.number().positive(),
  phone: z.string().min(9),
  accountReference: z.string().max(12).optional(),
  transactionDesc: z.string().max(13).optional(),
  idempotencyKey: z.string().min(1).max(64),
});

export type StkPushDto = z.infer<typeof stkPushSchema>;
