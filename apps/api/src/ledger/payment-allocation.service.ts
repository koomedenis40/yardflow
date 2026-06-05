import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentAllocationTargetType,
  PaymentRecordStatus,
  PaymentSourceType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type { AuthUser } from '@yardflow/types';
import {
  createBuyerPaymentSchema,
  createSupplierPaymentSchema,
} from '@yardflow/validation';
import { roundMoney } from '@yardflow/utils';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { BuyerOverpaymentException } from './exceptions';
import { LedgerEventsService } from './ledger-events.service';
import { derivePaymentStatus, remainingKes, toNum } from './ledger-math';
import { LEDGER_TRANSACTION_OPTIONS } from './ledger-transaction';

type Tx = Prisma.TransactionClient;

interface LockedSupplier {
  id: string;
  balanceKes: number;
  creditBalanceKes: number;
}

interface LockedBuyer {
  id: string;
  balanceKes: number;
}

@Injectable()
export class PaymentAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerEvents: LedgerEventsService,
    private readonly audit: AuditService,
  ) {}

  async sumAllocationsToTarget(
    tx: Tx,
    targetType: PaymentAllocationTargetType,
    targetId: string,
  ): Promise<number> {
    const agg = await tx.paymentAllocation.aggregate({
      where: { targetType, targetId },
      _sum: { allocatedAmountKes: true },
    });
    return toNum(agg._sum.allocatedAmountKes ?? 0);
  }

  async getPaidAmountForPurchase(purchaseId: string): Promise<number> {
    return this.sumAllocationsToTarget(
      this.prisma,
      PaymentAllocationTargetType.purchase,
      purchaseId,
    );
  }

  async getPaidAmountForSale(saleId: string): Promise<number> {
    return this.sumAllocationsToTarget(
      this.prisma,
      PaymentAllocationTargetType.sale,
      saleId,
    );
  }

  async refreshPurchaseStatus(tx: Tx, purchaseId: string) {
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) {
      return;
    }
    const paid = await this.sumAllocationsToTarget(
      tx,
      PaymentAllocationTargetType.purchase,
      purchaseId,
    );
    const status = derivePaymentStatus(toNum(purchase.totalValueKes), paid);
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { paymentStatus: status as PaymentStatus },
    });
  }

  async refreshSaleStatus(tx: Tx, saleId: string) {
    const sale = await tx.sale.findUnique({ where: { id: saleId } });
    if (!sale) {
      return;
    }
    const paid = await this.sumAllocationsToTarget(
      tx,
      PaymentAllocationTargetType.sale,
      saleId,
    );
    const status = derivePaymentStatus(toNum(sale.totalValueKes), paid);
    await tx.sale.update({
      where: { id: saleId },
      data: { paymentStatus: status as PaymentStatus },
    });
  }

  async applySupplierCreditOnPurchase(
    tx: Tx,
    params: {
      tenantId: string;
      supplierId: string;
      purchaseId: string;
      actorId: string;
    },
  ): Promise<number> {
    const supplier = await this.lockSupplier(tx, params.tenantId, params.supplierId);
    if (supplier.creditBalanceKes <= 0) {
      return 0;
    }

    const purchase = await tx.purchase.findFirst({
      where: { id: params.purchaseId, tenantId: params.tenantId },
    });
    if (!purchase) {
      return 0;
    }

    const alreadyPaid = await this.sumAllocationsToTarget(
      tx,
      PaymentAllocationTargetType.purchase,
      purchase.id,
    );
    const purchaseRemaining = remainingKes(toNum(purchase.totalValueKes), alreadyPaid);
    if (purchaseRemaining <= 0) {
      return 0;
    }

    const creditToApply = roundMoney(
      Math.min(supplier.creditBalanceKes, purchaseRemaining),
    );
    if (creditToApply <= 0) {
      return 0;
    }

    await tx.paymentAllocation.create({
      data: {
        tenantId: params.tenantId,
        sourceType: PaymentSourceType.supplier_credit_pool,
        sourceId: params.supplierId,
        targetType: PaymentAllocationTargetType.purchase,
        targetId: purchase.id,
        allocatedAmountKes: creditToApply,
      },
    });

    await tx.supplier.update({
      where: { id: params.supplierId },
      data: {
        creditBalanceKes: { decrement: creditToApply },
        balanceKes: { decrement: creditToApply },
      },
    });

    await this.refreshPurchaseStatus(tx, purchase.id);

    await this.ledgerEvents.emit(tx, {
      tenantId: params.tenantId,
      eventType: 'SUPPLIER_CREDIT_APPLIED',
      actorId: params.actorId,
      referenceType: 'purchase',
      referenceId: purchase.id,
      payload: {
        purchase_id: purchase.id,
        supplier_id: params.supplierId,
        amount_kes: creditToApply,
      },
    });

    return creditToApply;
  }

  async createSupplierPayment(user: AuthUser, body: unknown) {
    const parsed = createSupplierPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = user.tenantId!;
    const input = parsed.data;

    const existing = await this.prisma.supplierPayment.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { supplier: true },
    });
    if (existing) {
      return this.enrichSupplierPayment(existing);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockSupplier(tx, tenantId, input.supplierId);

      const payment = await tx.supplierPayment.create({
        data: {
          tenantId,
          supplierId: input.supplierId,
          amountKes: input.amountKes,
          paymentMethod: input.paymentMethod,
          status: PaymentRecordStatus.confirmed,
          createdBy: user.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      let paymentRemaining = input.amountKes;
      let allocatedToPurchases = 0;

      if (input.purchaseId) {
        const slice = await this.allocateToPurchase(tx, {
          tenantId,
          supplierId: input.supplierId,
          purchaseId: input.purchaseId,
          sourceType: PaymentSourceType.supplier_payment,
          sourceId: payment.id,
          maxAmount: paymentRemaining,
        });
        paymentRemaining = roundMoney(paymentRemaining - slice);
        allocatedToPurchases = roundMoney(allocatedToPurchases + slice);
      }

      if (paymentRemaining > 0) {
        const fifo = await this.allocateSupplierFifo(tx, {
          tenantId,
          supplierId: input.supplierId,
          sourceId: payment.id,
          maxAmount: paymentRemaining,
          skipPurchaseId: input.purchaseId,
        });
        paymentRemaining = roundMoney(paymentRemaining - fifo.allocated);
        allocatedToPurchases = roundMoney(allocatedToPurchases + fifo.allocated);
      }

      const creditIncrement = paymentRemaining;

      await tx.supplier.update({
        where: { id: input.supplierId },
        data: {
          balanceKes: { decrement: allocatedToPurchases },
          ...(creditIncrement > 0
            ? { creditBalanceKes: { increment: creditIncrement } }
            : {}),
        },
      });

      await this.ledgerEvents.emit(tx, {
        tenantId,
        eventType: 'SUPPLIER_PAYMENT_CREATED',
        actorId: user.userId,
        referenceType: 'supplier_payment',
        referenceId: payment.id,
        payload: {
          payment_id: payment.id,
          supplier_id: input.supplierId,
          amount_kes: input.amountKes,
          allocated_kes: allocatedToPurchases,
          credit_kes: creditIncrement,
        },
      });

      await this.audit.log({
        tenantId,
        userId: user.userId,
        action: 'supplier_payment:create',
        entityType: 'supplier_payment',
        entityId: payment.id,
      });

      return this.enrichSupplierPayment(
        await tx.supplierPayment.findUniqueOrThrow({
          where: { id: payment.id },
          include: { supplier: true },
        }),
      );
    }, LEDGER_TRANSACTION_OPTIONS);
  }

  async createBuyerPayment(user: AuthUser, body: unknown) {
    const parsed = createBuyerPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = user.tenantId!;
    const input = parsed.data;

    const existing = await this.prisma.buyerPayment.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { buyer: true },
    });
    if (existing) {
      return this.enrichBuyerPayment(existing);
    }

    return this.prisma.$transaction(async (tx) => {
      const buyer = await this.lockBuyer(tx, tenantId, input.buyerId);
      if (input.amountKes > buyer.balanceKes + 0.001) {
        throw new BuyerOverpaymentException();
      }

      const payment = await tx.buyerPayment.create({
        data: {
          tenantId,
          buyerId: input.buyerId,
          amountKes: input.amountKes,
          paymentMethod: input.paymentMethod,
          status: PaymentRecordStatus.confirmed,
          createdBy: user.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      let paymentRemaining = input.amountKes;

      if (input.saleId) {
        const slice = await this.allocateToSale(tx, {
          tenantId,
          buyerId: input.buyerId,
          saleId: input.saleId,
          sourceId: payment.id,
          maxAmount: paymentRemaining,
        });
        paymentRemaining = roundMoney(paymentRemaining - slice);
      }

      if (paymentRemaining > 0) {
        const fifo = await this.allocateBuyerFifo(tx, {
          tenantId,
          buyerId: input.buyerId,
          sourceId: payment.id,
          maxAmount: paymentRemaining,
          skipSaleId: input.saleId,
        });
        paymentRemaining = roundMoney(paymentRemaining - fifo.allocated);
      }

      if (paymentRemaining > 0.001) {
        throw new BuyerOverpaymentException();
      }

      await tx.buyer.update({
        where: { id: input.buyerId },
        data: { balanceKes: { decrement: input.amountKes } },
      });

      await this.ledgerEvents.emit(tx, {
        tenantId,
        eventType: 'BUYER_PAYMENT_CREATED',
        actorId: user.userId,
        referenceType: 'buyer_payment',
        referenceId: payment.id,
        payload: {
          payment_id: payment.id,
          buyer_id: input.buyerId,
          amount_kes: input.amountKes,
        },
      });

      await this.audit.log({
        tenantId,
        userId: user.userId,
        action: 'buyer_payment:create',
        entityType: 'buyer_payment',
        entityId: payment.id,
      });

      return this.enrichBuyerPayment(
        await tx.buyerPayment.findUniqueOrThrow({
          where: { id: payment.id },
          include: { buyer: true },
        }),
      );
    }, LEDGER_TRANSACTION_OPTIONS);
  }

  async getAllocationsForTarget(
    targetType: PaymentAllocationTargetType,
    targetId: string,
  ) {
    return this.prisma.paymentAllocation.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAllocationsForPayment(
    sourceType: PaymentSourceType,
    paymentId: string,
  ) {
    return this.prisma.paymentAllocation.findMany({
      where: { sourceType, sourceId: paymentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async enrichSupplierPayment(
    payment: Prisma.SupplierPaymentGetPayload<{ include: { supplier: true } }>,
  ) {
    const allocations = await this.getAllocationsForPayment(
      PaymentSourceType.supplier_payment,
      payment.id,
    );
    const allocatedKes = allocations.reduce(
      (sum, row) => sum + toNum(row.allocatedAmountKes),
      0,
    );
    return {
      ...payment,
      allocatedKes,
      allocations,
    };
  }

  async enrichBuyerPayment(
    payment: Prisma.BuyerPaymentGetPayload<{ include: { buyer: true } }>,
  ) {
    const allocations = await this.getAllocationsForPayment(
      PaymentSourceType.buyer_payment,
      payment.id,
    );
    const allocatedKes = allocations.reduce(
      (sum, row) => sum + toNum(row.allocatedAmountKes),
      0,
    );
    return {
      ...payment,
      allocatedKes,
      allocations,
    };
  }

  async enrichPurchase(purchase: Prisma.PurchaseGetPayload<object>) {
    const allocations = await this.getAllocationsForTarget(
      PaymentAllocationTargetType.purchase,
      purchase.id,
    );
    const paidAmountKes = allocations.reduce(
      (sum, row) => sum + toNum(row.allocatedAmountKes),
      0,
    );
    const totalValueKes = toNum(purchase.totalValueKes);
    return {
      ...purchase,
      paidAmountKes,
      remainingKes: remainingKes(totalValueKes, paidAmountKes),
      allocations,
    };
  }

  async enrichSale(sale: Prisma.SaleGetPayload<object>) {
    const allocations = await this.getAllocationsForTarget(
      PaymentAllocationTargetType.sale,
      sale.id,
    );
    const paidAmountKes = allocations.reduce(
      (sum, row) => sum + toNum(row.allocatedAmountKes),
      0,
    );
    const totalValueKes = toNum(sale.totalValueKes);
    return {
      ...sale,
      paidAmountKes,
      remainingKes: remainingKes(totalValueKes, paidAmountKes),
      allocations,
    };
  }

  private async allocateSupplierFifo(
    tx: Tx,
    params: {
      tenantId: string;
      supplierId: string;
      sourceId: string;
      maxAmount: number;
      skipPurchaseId?: string;
    },
  ): Promise<{ allocated: number }> {
    const purchases = await tx.purchase.findMany({
      where: {
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        paymentStatus: { in: [PaymentStatus.unpaid, PaymentStatus.partial] },
        ...(params.skipPurchaseId ? { id: { not: params.skipPurchaseId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    let remaining = params.maxAmount;
    let allocated = 0;

    for (const purchase of purchases) {
      if (remaining <= 0) {
        break;
      }
      const slice = await this.allocateToPurchase(tx, {
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        purchaseId: purchase.id,
        sourceType: PaymentSourceType.supplier_payment,
        sourceId: params.sourceId,
        maxAmount: remaining,
      });
      remaining = roundMoney(remaining - slice);
      allocated = roundMoney(allocated + slice);
    }

    return { allocated };
  }

  private async allocateBuyerFifo(
    tx: Tx,
    params: {
      tenantId: string;
      buyerId: string;
      sourceId: string;
      maxAmount: number;
      skipSaleId?: string;
    },
  ): Promise<{ allocated: number }> {
    const sales = await tx.sale.findMany({
      where: {
        tenantId: params.tenantId,
        buyerId: params.buyerId,
        paymentStatus: { in: [PaymentStatus.unpaid, PaymentStatus.partial] },
        ...(params.skipSaleId ? { id: { not: params.skipSaleId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    let remaining = params.maxAmount;
    let allocated = 0;

    for (const sale of sales) {
      if (remaining <= 0) {
        break;
      }
      const slice = await this.allocateToSale(tx, {
        tenantId: params.tenantId,
        buyerId: params.buyerId,
        saleId: sale.id,
        sourceId: params.sourceId,
        maxAmount: remaining,
      });
      remaining = roundMoney(remaining - slice);
      allocated = roundMoney(allocated + slice);
    }

    return { allocated };
  }

  private async allocateToPurchase(
    tx: Tx,
    params: {
      tenantId: string;
      supplierId: string;
      purchaseId: string;
      sourceType: PaymentSourceType;
      sourceId: string;
      maxAmount: number;
    },
  ): Promise<number> {
    const purchase = await tx.purchase.findFirst({
      where: {
        id: params.purchaseId,
        tenantId: params.tenantId,
        supplierId: params.supplierId,
      },
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found for supplier');
    }

    await tx.$queryRaw`
      SELECT id FROM purchases
      WHERE id = ${params.purchaseId}::uuid
      FOR UPDATE
    `;

    const paid = await this.sumAllocationsToTarget(
      tx,
      PaymentAllocationTargetType.purchase,
      purchase.id,
    );
    const purchaseRemaining = remainingKes(toNum(purchase.totalValueKes), paid);
    if (purchaseRemaining <= 0) {
      return 0;
    }

    const slice = roundMoney(Math.min(params.maxAmount, purchaseRemaining));
    if (slice <= 0) {
      return 0;
    }

    await tx.paymentAllocation.create({
      data: {
        tenantId: params.tenantId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        targetType: PaymentAllocationTargetType.purchase,
        targetId: purchase.id,
        allocatedAmountKes: slice,
      },
    });

    await this.refreshPurchaseStatus(tx, purchase.id);
    return slice;
  }

  private async allocateToSale(
    tx: Tx,
    params: {
      tenantId: string;
      buyerId: string;
      saleId: string;
      sourceId: string;
      maxAmount: number;
    },
  ): Promise<number> {
    const sale = await tx.sale.findFirst({
      where: {
        id: params.saleId,
        tenantId: params.tenantId,
        buyerId: params.buyerId,
      },
    });
    if (!sale) {
      throw new NotFoundException('Sale not found for buyer');
    }

    await tx.$queryRaw`
      SELECT id FROM sales
      WHERE id = ${params.saleId}::uuid
      FOR UPDATE
    `;

    const paid = await this.sumAllocationsToTarget(
      tx,
      PaymentAllocationTargetType.sale,
      sale.id,
    );
    const saleRemaining = remainingKes(toNum(sale.totalValueKes), paid);
    if (saleRemaining <= 0) {
      return 0;
    }

    const slice = roundMoney(Math.min(params.maxAmount, saleRemaining));
    if (slice <= 0) {
      return 0;
    }

    await tx.paymentAllocation.create({
      data: {
        tenantId: params.tenantId,
        sourceType: PaymentSourceType.buyer_payment,
        sourceId: params.sourceId,
        targetType: PaymentAllocationTargetType.sale,
        targetId: sale.id,
        allocatedAmountKes: slice,
      },
    });

    await this.refreshSaleStatus(tx, sale.id);
    return slice;
  }

  private async lockSupplier(
    tx: Tx,
    tenantId: string,
    supplierId: string,
  ): Promise<LockedSupplier> {
    const rows = await tx.$queryRaw<LockedSupplier[]>`
      SELECT
        id,
        balance_kes AS "balanceKes",
        credit_balance_kes AS "creditBalanceKes"
      FROM suppliers
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${supplierId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Supplier not found');
    }
    return {
      id: row.id,
      balanceKes: toNum(row.balanceKes as unknown as { toString(): string }),
      creditBalanceKes: toNum(row.creditBalanceKes as unknown as { toString(): string }),
    };
  }

  private async lockBuyer(
    tx: Tx,
    tenantId: string,
    buyerId: string,
  ): Promise<LockedBuyer> {
    const rows = await tx.$queryRaw<LockedBuyer[]>`
      SELECT
        id,
        balance_kes AS "balanceKes"
      FROM buyers
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${buyerId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Buyer not found');
    }
    return {
      id: row.id,
      balanceKes: toNum(row.balanceKes as unknown as { toString(): string }),
    };
  }
}
