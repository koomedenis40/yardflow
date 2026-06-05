import { z } from 'zod';

const phoneSchema = z.string().trim().min(7).max(20).optional();

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  notes: z.string().trim().max(500).optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const createBuyerSchema = createSupplierSchema;
export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  defaultBuyingPricePerKg: z.number().finite().nonnegative(),
  defaultSellingPricePerKg: z.number().finite().nonnegative(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
