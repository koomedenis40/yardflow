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
  createBuyerPayment,
  createPurchase,
  createSale,
  createSupplier,
  createSupplierPayment,
  createTestCategory,
  loginAs,
} from './helpers/ledger-test-utils';

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

describe('YardFlow Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    prisma = app.get(PrismaService);
    ownerToken = await loginAs(app, 'owner@demo.local');
  }, 30_000);

  afterAll(async () => {
    await app.close();
  }, 30_000);

  it('full supplier payment settles purchase', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 500,
    }).expect(201);

    const supplier = await request(app.getHttpServer())
      .get(`/v1/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Number(supplier.body.balanceKes)).toBeCloseTo(0, 1);
    expect(supplier.body.unpaidPurchases).toHaveLength(0);
  });

  it('partial supplier payment leaves purchase partial', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    const purchaseRes = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 200,
    }).expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/v1/purchases/${purchaseRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(detail.body.paymentStatus).toBe('partial');
    expect(Number(detail.body.paidAmountKes)).toBeCloseTo(200, 1);
    expect(Number(detail.body.remainingKes)).toBeCloseTo(300, 1);
  });

  it('FIFO supplier allocation settles oldest purchase first', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    const first = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 5,
      pricePerKg: 100,
    }).expect(201);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 5,
      pricePerKg: 100,
    }).expect(201);

    const paymentRes = await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 500,
    }).expect(201);

    const paymentDetail = await request(app.getHttpServer())
      .get(`/v1/supplier-payments/${paymentRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const firstAlloc = paymentDetail.body.allocations.find(
      (a: { targetId: string }) => a.targetId === first.body.id,
    );
    expect(firstAlloc).toBeDefined();
    expect(Number(firstAlloc.allocatedAmountKes)).toBeCloseTo(500, 1);

    const firstDetail = await request(app.getHttpServer())
      .get(`/v1/purchases/${first.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(firstDetail.body.paymentStatus).toBe('paid');
  });

  it('supplier overpayment creates credit pool', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 800,
    }).expect(201);

    const supplier = await request(app.getHttpServer())
      .get(`/v1/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Number(supplier.body.balanceKes)).toBeCloseTo(0, 1);
    expect(Number(supplier.body.creditBalanceKes)).toBeCloseTo(300, 1);
  });

  it('supplier credit auto-consumed on next purchase', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 800,
    }).expect(201);

    const secondPurchase = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    const supplier = await request(app.getHttpServer())
      .get(`/v1/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Number(supplier.body.creditBalanceKes)).toBeCloseTo(0, 1);
    expect(Number(supplier.body.balanceKes)).toBeCloseTo(200, 1);
    expect(secondPurchase.body.paymentStatus).toBe('partial');
  });

  it('buyer partial payment leaves sale partial', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 20,
      pricePerKg: 50,
    }).expect(201);

    const saleRes = await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 10,
      pricePerKg: 100,
    }).expect(201);

    await createBuyerPayment(app, ownerToken, {
      buyerId,
      amountKes: 500,
    }).expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/v1/sales/${saleRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(detail.body.paymentStatus).toBe('partial');
    expect(Number(detail.body.paidAmountKes)).toBeCloseTo(500, 1);
    expect(Number(detail.body.remainingKes)).toBeCloseTo(500, 1);
  });

  it('buyer full payment clears receivable', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 10,
      pricePerKg: 100,
    }).expect(201);

    await createBuyerPayment(app, ownerToken, {
      buyerId,
      amountKes: 1000,
    }).expect(201);

    const buyer = await request(app.getHttpServer())
      .get(`/v1/buyers/${buyerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Number(buyer.body.balanceKes)).toBeCloseTo(0, 1);
    expect(buyer.body.unpaidSales).toHaveLength(0);
  });

  it('buyer overpayment is rejected', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 5,
      pricePerKg: 100,
    }).expect(201);

    const res = await createBuyerPayment(app, ownerToken, {
      buyerId,
      amountKes: 1000,
    }).expect(422);

    expect(res.body.code).toBe('BUYER_OVERPAYMENT_NOT_ALLOWED');
  });

  it('payment status transitions unpaid to partial to paid', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    const purchaseRes = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    expect(purchaseRes.body.paymentStatus).toBe('unpaid');

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 200,
    }).expect(201);

    const partial = await request(app.getHttpServer())
      .get(`/v1/purchases/${purchaseRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(partial.body.paymentStatus).toBe('partial');

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 300,
    }).expect(201);

    const paid = await request(app.getHttpServer())
      .get(`/v1/purchases/${purchaseRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(paid.body.paymentStatus).toBe('paid');
  });

  it('payment idempotency returns same payment without duplicate allocation', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const key = randomUUID();

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    const first = await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 500,
      idempotencyKey: key,
    }).expect(201);

    const second = await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 500,
      idempotencyKey: key,
    }).expect(201);

    expect(second.body.id).toBe(first.body.id);

    const allocations = await prisma.paymentAllocation.count({
      where: { sourceId: first.body.id },
    });
    expect(allocations).toBe(1);
  });

  it('allocation audit sums match payment amount', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 5,
      pricePerKg: 100,
    }).expect(201);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 5,
      pricePerKg: 100,
    }).expect(201);

    const paymentRes = await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 750,
    }).expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/v1/supplier-payments/${paymentRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Number(detail.body.allocatedKes)).toBeCloseTo(750, 1);
    const allocSum = detail.body.allocations.reduce(
      (sum: number, row: { allocatedAmountKes: string }) => sum + Number(row.allocatedAmountKes),
      0,
    );
    expect(allocSum).toBeCloseTo(750, 1);
  });

  it('tenant isolation on supplier payments list', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 5,
      pricePerKg: 10,
    }).expect(201);

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 50,
    }).expect(201);

    const payments = await request(app.getHttpServer())
      .get('/v1/supplier-payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(payments.body.every((p: { tenantId: string }) => p.tenantId)).toBe(true);
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'demo-yard' } });
    expect(payments.body.every((p: { tenantId: string }) => p.tenantId === tenant.id)).toBe(true);
  });

  it('concurrent supplier payments do not over-allocate', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    const [resA, resB] = await Promise.all([
      createSupplierPayment(app, ownerToken, {
        supplierId,
        amountKes: 400,
      }),
      createSupplierPayment(app, ownerToken, {
        supplierId,
        amountKes: 400,
      }),
    ]);

    expect([resA.status, resB.status].sort()).toEqual([201, 201]);

    const supplier = await request(app.getHttpServer())
      .get(`/v1/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const purchase = await prisma.purchase.findFirst({
      where: { supplierId },
      orderBy: { createdAt: 'asc' },
    });
    const totalAllocated = await prisma.paymentAllocation.aggregate({
      where: {
        targetType: 'purchase',
        targetId: purchase!.id,
      },
      _sum: { allocatedAmountKes: true },
    });

    expect(Number(totalAllocated._sum.allocatedAmountKes ?? 0)).toBeLessThanOrEqual(500.01);
    expect(Number(supplier.body.balanceKes)).toBeGreaterThanOrEqual(0);
    expect(Number(supplier.body.creditBalanceKes)).toBeGreaterThanOrEqual(0);
  });

  it('balances summary reflects supplier owed and buyer receivable', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 50,
    }).expect(201);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 4,
      pricePerKg: 50,
    }).expect(201);

    await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 5,
      pricePerKg: 100,
    }).expect(201);

    const before = await request(app.getHttpServer())
      .get('/v1/balances/summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Number(before.body.supplierOwedKes)).toBeGreaterThan(0);
    expect(Number(before.body.buyerReceivableKes)).toBeGreaterThan(0);

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 500,
    }).expect(201);

    await createBuyerPayment(app, ownerToken, {
      buyerId,
      amountKes: 500,
    }).expect(201);

    const after = await request(app.getHttpServer())
      .get('/v1/balances/summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Number(after.body.supplierOwedKes)).toBeLessThan(Number(before.body.supplierOwedKes));
    expect(Number(after.body.buyerReceivableKes)).toBeLessThan(Number(before.body.buyerReceivableKes));
  });

  it('purchase and sale detail show paid and remaining amounts', async () => {
    const categoryId = await createTestCategory(prisma);
    const supplierId = await createSupplier(app, ownerToken);
    const buyerId = await createBuyer(app, ownerToken);

    const purchaseRes = await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 10,
      pricePerKg: 40,
    }).expect(201);

    await createSupplierPayment(app, ownerToken, {
      supplierId,
      amountKes: 200,
    }).expect(201);

    const purchaseDetail = await request(app.getHttpServer())
      .get(`/v1/purchases/${purchaseRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(purchaseDetail.body.allocations.length).toBeGreaterThan(0);
    expect(Number(purchaseDetail.body.paidAmountKes)).toBeCloseTo(200, 1);
    expect(Number(purchaseDetail.body.remainingKes)).toBeCloseTo(200, 1);

    await createPurchase(app, ownerToken, {
      supplierId,
      categoryId,
      weightKg: 20,
      pricePerKg: 40,
    }).expect(201);

    const saleRes = await createSale(app, ownerToken, {
      buyerId,
      categoryId,
      weightKg: 5,
      pricePerKg: 80,
    }).expect(201);

    await createBuyerPayment(app, ownerToken, {
      buyerId,
      amountKes: 200,
    }).expect(201);

    const saleDetail = await request(app.getHttpServer())
      .get(`/v1/sales/${saleRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(saleDetail.body.allocations.length).toBeGreaterThan(0);
    expect(Number(saleDetail.body.paidAmountKes)).toBeGreaterThan(0);
    expect(Number(saleDetail.body.remainingKes)).toBeGreaterThanOrEqual(0);
  });
});
