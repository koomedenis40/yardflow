import { z } from 'zod';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  CORRECTABLE_TYPE,
  TENANT_STATUS,
  USER_TENANT_ROLE,
} from '@yardflow/types';

// Reuse the canonical value sets from @yardflow/types so schemas never drift from the contracts.
export const paymentMethodSchema = z.enum(PAYMENT_METHOD);
export const paymentStatusSchema = z.enum(PAYMENT_STATUS);
export const correctableTypeSchema = z.enum(CORRECTABLE_TYPE);
export const tenantStatusSchema = z.enum(TENANT_STATUS);
export const userTenantRoleSchema = z.enum(USER_TENANT_ROLE);

/** Manual (non-M-Pesa) methods confirm immediately; M-Pesa methods are async/pending. */
export const manualPaymentMethodSchema = z.enum(['cash', 'manual']);
