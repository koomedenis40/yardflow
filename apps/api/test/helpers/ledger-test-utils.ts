import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';

export async function loginAs(
  app: INestApplication,
  email: string,
  tenantSlug = 'demo-yard',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password: 'Password123!', tenantSlug })
    .expect(201);
  return res.body.accessToken as string;
}

export async function getFirstCategoryId(
  app: INestApplication,
  token: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .get('/v1/categories')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body[0].id as string;
}

export async function createSupplier(
  app: INestApplication,
  token: string,
  name = `Supplier ${randomUUID().slice(0, 8)}`,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/suppliers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, phone: '0712345678' })
    .expect(201);
  return res.body.id as string;
}

export async function createBuyer(
  app: INestApplication,
  token: string,
  name = `Buyer ${randomUUID().slice(0, 8)}`,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/buyers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, phone: '0798765432' })
    .expect(201);
  return res.body.id as string;
}

export function createPurchase(
  app: INestApplication,
  token: string,
  params: {
    supplierId: string;
    categoryId: string;
    weightKg: number;
    pricePerKg: number;
    idempotencyKey?: string;
  },
) {
  return request(app.getHttpServer())
    .post('/v1/purchases')
    .set('Authorization', `Bearer ${token}`)
    .send({
      ...params,
      idempotencyKey: params.idempotencyKey ?? randomUUID(),
    });
}

export function createSale(
  app: INestApplication,
  token: string,
  params: {
    buyerId: string;
    categoryId: string;
    weightKg: number;
    pricePerKg: number;
    idempotencyKey?: string;
  },
) {
  return request(app.getHttpServer())
    .post('/v1/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      ...params,
      idempotencyKey: params.idempotencyKey ?? randomUUID(),
    });
}

export async function createTestCategory(
  prisma: PrismaService,
  tenantSlug = 'demo-yard',
): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantSlug } });
  const category = await prisma.scrapCategory.create({
    data: {
      tenantId: tenant.id,
      name: `E2E ${randomUUID().slice(0, 8)}`,
      sortOrder: 9000,
      defaultBuyingPricePerKg: 0,
      defaultSellingPricePerKg: 0,
    },
  });
  return category.id;
}

export function stockForCategory(
  balances: Array<{ categoryId: string; weightKg: string | number }>,
  categoryId: string,
): number {
  const row = balances.find((b) => b.categoryId === categoryId);
  return row ? Number(row.weightKg) : 0;
}

export function createSupplierPayment(
  app: INestApplication,
  token: string,
  params: {
    supplierId: string;
    amountKes: number;
    paymentMethod?: string;
    purchaseId?: string;
    idempotencyKey?: string;
  },
) {
  return request(app.getHttpServer())
    .post('/v1/supplier-payments')
    .set('Authorization', `Bearer ${token}`)
    .send({
      paymentMethod: 'cash',
      ...params,
      idempotencyKey: params.idempotencyKey ?? randomUUID(),
    });
}

export function createBuyerPayment(
  app: INestApplication,
  token: string,
  params: {
    buyerId: string;
    amountKes: number;
    paymentMethod?: string;
    saleId?: string;
    idempotencyKey?: string;
  },
) {
  return request(app.getHttpServer())
    .post('/v1/buyer-payments')
    .set('Authorization', `Bearer ${token}`)
    .send({
      paymentMethod: 'cash',
      ...params,
      idempotencyKey: params.idempotencyKey ?? randomUUID(),
    });
}
