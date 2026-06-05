import { existsSync } from 'fs';
import { resolve } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { config as loadEnv } from 'dotenv';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createBuyer,
  createPurchase,
  createSale,
  createSupplier,
  createTestCategory,
  loginAs,
  stockForCategory,
} from './helpers/ledger-test-utils';

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

describe('YardFlow Ledger (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let cashierToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    prisma = app.get(PrismaService);
    ownerToken = await loginAs(app, 'owner@demo.local');
    cashierToken = await loginAs(app, 'cashier@demo.local');
  }, 30_000);

  afterAll(async () => {
    await app.close();
  }, 30_000);

  it('purchase increases stock', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    const before = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const beforeKg = stockForCategory(before.body, categoryId);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 100,
      pricePerKg: 50,
    }).expect(201);

    const after = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(stockForCategory(after.body, categoryId)).toBeCloseTo(beforeKg + 100, 2);
  });

  it('sale decreases stock', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 80,
      pricePerKg: 40,
    }).expect(201);

    const before = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const beforeKg = stockForCategory(before.body, categoryId);

    await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 30,
      pricePerKg: 70,
    }).expect(201);

    const after = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(stockForCategory(after.body, categoryId)).toBeCloseTo(beforeKg - 30, 2);
  });

  it('oversell returns 409 STOCK_INSUFFICIENT', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    const res = await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 50,
      pricePerKg: 80,
    }).expect(409);

    expect(res.body.code).toBe('STOCK_INSUFFICIENT');
  });

  it('weighted average calculation on purchases', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 100,
      pricePerKg: 40,
    }).expect(201);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 100,
      pricePerKg: 60,
    }).expect(201);

    const inventory = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const row = inventory.body.find((b: { categoryId: string }) => b.categoryId === categoryId);
    expect(Number(row.averageCostPerKg)).toBeCloseTo(50, 1);
  });

  it('sale profit snapshot is stored immutably', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 50,
      pricePerKg: 40,
    }).expect(201);

    const saleRes = await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 20,
      pricePerKg: 80,
    }).expect(201);

    expect(Number(saleRes.body.costPerKgAtSale)).toBeCloseTo(40, 1);
    expect(Number(saleRes.body.totalCostKes)).toBeCloseTo(800, 1);
    expect(Number(saleRes.body.grossProfitKes)).toBeCloseTo(800, 1);
    expect(Number(saleRes.body.totalValueKes)).toBeCloseTo(1600, 1);
  });

  it('correction creates stock movement', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const purchaseRes = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 40,
      pricePerKg: 30,
    }).expect(201);

    await request(app.getHttpServer())
      .post('/v1/corrections')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetType: 'PURCHASE',
        targetId: purchaseRes.body.id,
        weightDeltaKg: -5,
        valueDeltaKes: -150,
        reason: 'Scale read error',
      })
      .expect(201);

    const movements = await request(app.getHttpServer())
      .get('/v1/inventory/movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      movements.body.some(
        (m: { movementType: string; categoryId: string }) =>
          m.movementType === 'PURCHASE_CORRECTION' && m.categoryId === categoryId,
      ),
    ).toBe(true);
  });

  it('correction stock safety returns 422', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const purchaseRes = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 15,
      pricePerKg: 20,
    }).expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/corrections')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetType: 'PURCHASE',
        targetId: purchaseRes.body.id,
        weightDeltaKg: -1000,
        reason: 'Would break stock',
      })
      .expect(422);

    expect(res.body.code).toBe('CORRECTION_WOULD_BREAK_STOCK');
  });

  it('stock adjustment creates movement', async () => {
    const categoryId = await createTestCategory(prisma);

    await request(app.getHttpServer())
      .post('/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        categoryId,
        weightDeltaKg: 5,
        reason: 'Physical count higher than system',
      })
      .expect(201);

    const movements = await request(app.getHttpServer())
      .get('/v1/inventory/movements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      movements.body.some(
        (m: { movementType: string; categoryId: string }) =>
          m.movementType === 'STOCK_ADJUSTMENT' && m.categoryId === categoryId,
      ),
    ).toBe(true);
  });

  it('tenant isolation on purchase get', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const purchaseRes = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 5,
      pricePerKg: 10,
    }).expect(201);

    const otherPurchase = await prisma.purchase.findFirst({
      where: { tenant: { slug: 'other-yard' } },
    });

    if (otherPurchase) {
      await request(app.getHttpServer())
        .get(`/v1/purchases/${otherPurchase.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    }

    await request(app.getHttpServer())
      .get(`/v1/purchases/${purchaseRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('cashier can create purchase but not adjustment', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, cashierToken);

    await createPurchase(app, cashierToken, {
      supplierId,
      categoryId,
      weightKg: 5,
      pricePerKg: 25,
    }).expect(201);

    await request(app.getHttpServer())
      .post('/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        categoryId,
        weightDeltaKg: 1,
        reason: 'Cashier should not adjust',
      })
      .expect(403);
  });

  it('cashier cannot create correction', async () => {
    await request(app.getHttpServer())
      .post('/v1/corrections')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        targetType: 'PURCHASE',
        targetId: randomUUID(),
        weightDeltaKg: 1,
        reason: 'Blocked',
      })
      .expect(403);
  });

  it('owner can create correction and adjustment', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const purchaseRes = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 20,
    }).expect(201);

    await request(app.getHttpServer())
      .post('/v1/corrections')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetType: 'PURCHASE',
        targetId: purchaseRes.body.id,
        weightDeltaKg: 1,
        reason: 'Owner correction ok',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        categoryId,
        weightDeltaKg: 2,
        reason: 'Owner adjustment ok',
      })
      .expect(201);
  });

  it('concurrent sales: one succeeds one fails with 409', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerA = await createBuyer(app, ownerToken);
    const buyerB = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 500,
      pricePerKg: 30,
    }).expect(201);

    const [resA, resB] = await Promise.all([
      createSale(app, ownerToken, {
        buyerId: buyerA,
        categoryId,
        weightKg: 400,
        pricePerKg: 50,
      }),
      createSale(app, ownerToken, {
        buyerId: buyerB,
        categoryId,
        weightKg: 400,
        pricePerKg: 50,
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const inventory = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(stockForCategory(inventory.body, categoryId)).toBeCloseTo(100, 1);
  });

  it('purchase idempotency does not double stock', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const key = randomUUID();

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 25,
      pricePerKg: 10,
      idempotencyKey: key,
    }).expect(201);

    const before = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const beforeKg = stockForCategory(before.body, categoryId);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 25,
      pricePerKg: 10,
      idempotencyKey: key,
    }).expect(201);

    const after = await request(app.getHttpServer())
      .get('/v1/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(stockForCategory(after.body, categoryId)).toBeCloseTo(beforeKg, 2);
  });

  it('final stock integrity: balance matches movement sum for category', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 60,
      pricePerKg: 45,
    }).expect(201);

    await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 10,
      pricePerKg: 70,
    }).expect(201);

    const [inventory, movements] = await Promise.all([
      request(app.getHttpServer())
        .get('/v1/inventory')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200),
      request(app.getHttpServer())
        .get('/v1/inventory/movements')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200),
    ]);

    const balanceKg = stockForCategory(inventory.body, categoryId);
    const movementSum = movements.body
      .filter((m: { categoryId: string }) => m.categoryId === categoryId)
      .reduce((sum: number, m: { weightDeltaKg: string }) => sum + Number(m.weightDeltaKg), 0);

    expect(balanceKg).toBeGreaterThanOrEqual(0);
    expect(balanceKg).toBeCloseTo(movementSum, 0);
  });
});
