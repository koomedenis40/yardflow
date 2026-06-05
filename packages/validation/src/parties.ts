import { z } from 'zod';
import { moneySchema } from './common';

const phoneSchema = z.string().trim().min(7).max(20).optional();

export const createSupplierSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  idNumber: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const createBuyerSchema = createSupplierSchema;
export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;

export const updateBuyerSchema = updateSupplierSchema;
export type UpdateBuyerInput = z.infer<typeof updateBuyerSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  defaultBuyingPricePerKg: moneySchema,
  defaultSellingPricePerKg: moneySchema,
  sortOrder: z.number().int().nonnegative().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
