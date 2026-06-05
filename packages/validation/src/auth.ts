import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().trim().min(7).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    tenantSlug: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.email) || Boolean(v.phone), {
    message: 'Email or phone is required',
    path: ['email'],
  });
export type LoginInput = z.infer<typeof loginSchema>;
