import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Daraja / M-Pesa
  DARAJA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  DARAJA_BASE_URL: z
    .string()
    .default('https://sandbox.safaricom.co.ke'),
  DARAJA_CONSUMER_KEY: z.string().default(''),
  DARAJA_CONSUMER_SECRET: z.string().default(''),
  DARAJA_SHORTCODE: z.string().default('174379'),
  DARAJA_PASSKEY: z.string().default(''),
  DARAJA_TRANSACTION_TYPE: z
    .string()
    .default('CustomerPayBillOnline'),
  DARAJA_CALLBACK_BASE_URL: z.string().default(''),
  DARAJA_TEST_PHONE: z.string().default('254708374149'),
  DARAJA_B2C_SHORTCODE: z.string().optional().default(''),
  DARAJA_INITIATOR_NAME: z.string().optional().default(''),
  DARAJA_SECURITY_CREDENTIAL: z.string().optional().default(''),
  DARAJA_TOKEN_TTL_BUFFER: z.coerce.number().default(60),
});

export type EnvConfig = z.infer<typeof envSchema>;
