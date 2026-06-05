import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CorrectableType,
  PaymentStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import type { AuthUser } from '@yardflow/types';
import {
  createCorrectionSchema,
  createPurchaseSchema,
  createSaleSchema,
  createStockAdjustmentSchema,
} from '@yardflow/validation';
import { roundWeight } from '@yardflow/utils';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CorrectionWouldBreakStockException,
  StockInsufficientException,
} from './exceptions';
import { LedgerEventsService } from './ledger-events.service';
import {
  calcPurchaseTotal,
  calcSaleProfit,
  calcSaleTotal,
  calcWeightedAverageCost,
  projectedStockKg,
  toNum,
} from './ledger-math';
import { LEDGER_TRANSACTION_OPTIONS } from './ledger-transaction';

type Tx = Prisma.TransactionClient;

interface LockedStock {
  tenantId: string;
  categoryId: string;
  weightKg: number;
  averageCostPerKg: number;
}

@Injectable()
export class LedgerTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerEvents: LedgerEventsService,
    private readonly audit: AuditService,
  ) {}

  async createPurchase(user: AuthUser, body: unknown) {
    const parsed = createPurchaseSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = this.requireTenant(user);
    const input = parsed.data;

    const existing = await this.prisma.purchase.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertPartyAndCategory(tx, tenantId, input.supplierId, input.categoryId, 'supplier');

      const totalValueKes = calcPurchaseTotal(input.weightKg, input.pricePerKg);
      const stock = await this.lockStockBalance(tx, tenantId, input.categoryId);

      const newWeight = projectedStockKg(stock.weightKg, input.weightKg);
      const newAvg = calcWeightedAverageCost(
        stock.weightKg,
        stock.averageCostPerKg,
        input.weightKg,
        input.pricePerKg,
      );

      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          supplierId: input.supplierId,
          categoryId: input.categoryId,
          weightKg: input.weightKg,
          pricePerKg: input.pricePerKg,
          totalValueKes,
          paymentStatus: PaymentStatus.unpaid,
          createdBy: user.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await this.updateStockBalance(tx, tenantId, input.categoryId, newWeight, newAvg);

      await tx.supplier.update({
        where: { id: input.supplierId },
        data: { balanceKes: { increment: totalValueKes } },
      });

      await this.recordMovement(tx, {
        tenantId,
        categoryId: input.categoryId,
        movementType: StockMovementType.PURCHASE,
        weightDeltaKg: input.weightKg,
        valueDeltaKes: totalValueKes,
        referenceType: 'purchase',
        referenceId: purchase.id,
        createdBy: user.userId,
      });

      await this.ledgerEvents.emit(tx, {
        tenantId,
        eventType: 'PURCHASE_CREATED',
        actorId: user.userId,
        referenceType: 'purchase',
        referenceId: purchase.id,
        payload: {
          purchase_id: purchase.id,
          weight_kg: input.weightKg,
          price_per_kg: input.pricePerKg,
          total_value_kes: totalValueKes,
        },
      });

      await this.audit.log({
        tenantId,
        userId: user.userId,
        action: 'purchase:create',
        entityType: 'purchase',
        entityId: purchase.id,
      });

      return purchase;
    }, LEDGER_TRANSACTION_OPTIONS);
  }

  async createSale(user: AuthUser, body: unknown) {
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = this.requireTenant(user);
    const input = parsed.data;

    const existing = await this.prisma.sale.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey },
      },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertPartyAndCategory(tx, tenantId, input.buyerId, input.categoryId, 'buyer');

      const stock = await this.lockStockBalance(tx, tenantId, input.categoryId);
      if (stock.weightKg < input.weightKg) {
        throw new StockInsufficientException();
      }

      const totalValueKes = calcSaleTotal(input.weightKg, input.pricePerKg);
      const { costPerKgAtSale, totalCostKes, grossProfitKes } = calcSaleProfit(
        totalValueKes,
        input.weightKg,
        stock.averageCostPerKg,
      );

      const newWeight = projectedStockKg(stock.weightKg, -input.weightKg);

      const sale = await tx.sale.create({
        data: {
          tenantId,
          buyerId: input.buyerId,
          categoryId: input.categoryId,
          weightKg: input.weightKg,
          pricePerKg: input.pricePerKg,
          totalValueKes,
          costPerKgAtSale,
          totalCostKes,
          grossProfitKes,
          paymentStatus: PaymentStatus.unpaid,
          createdBy: user.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await this.updateStockBalance(
        tx,
        tenantId,
        input.categoryId,
        newWeight,
        stock.averageCostPerKg,
      );

      await tx.buyer.update({
        where: { id: input.buyerId },
        data: { balanceKes: { increment: totalValueKes } },
      });

      await this.recordMovement(tx, {
        tenantId,
        categoryId: input.categoryId,
        movementType: StockMovementType.SALE,
        weightDeltaKg: -input.weightKg,
        valueDeltaKes: totalValueKes,
        referenceType: 'sale',
        referenceId: sale.id,
        createdBy: user.userId,
      });

      await this.ledgerEvents.emit(tx, {
        tenantId,
        eventType: 'SALE_CREATED',
        actorId: user.userId,
        referenceType: 'sale',
        referenceId: sale.id,
        payload: {
          sale_id: sale.id,
          weight_kg: input.weightKg,
          cost_per_kg_at_sale: costPerKgAtSale,
          total_cost_kes: totalCostKes,
          gross_profit_kes: grossProfitKes,
        },
      });

      await this.audit.log({
        tenantId,
        userId: user.userId,
        action: 'sale:create',
        entityType: 'sale',
        entityId: sale.id,
      });

      return sale;
    }, LEDGER_TRANSACTION_OPTIONS);
  }

  async createCorrection(user: AuthUser, body: unknown) {
    const parsed = createCorrectionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = this.requireTenant(user);
    const input = parsed.data;
    const weightDelta = input.weightDeltaKg ?? 0;
    const valueDelta = input.valueDeltaKes ?? 0;

    return this.prisma.$transaction(async (tx) => {
      let categoryId: string;

      if (input.targetType === 'PURCHASE') {
        const purchase = await tx.purchase.findFirst({
          where: { id: input.targetId, tenantId },
        });
        if (!purchase) {
          throw new NotFoundException('Purchase not found');
        }
        categoryId = purchase.categoryId;

        const stock = await this.lockStockBalance(tx, tenantId, categoryId);
        if (projectedStockKg(stock.weightKg, weightDelta) < 0) {
          throw new CorrectionWouldBreakStockException();
        }

        const newWeight = projectedStockKg(stock.weightKg, weightDelta);
        let newAvg = stock.averageCostPerKg;
        if (weightDelta > 0 && purchase.pricePerKg) {
          newAvg = calcWeightedAverageCost(
            stock.weightKg,
            stock.averageCostPerKg,
            weightDelta,
            toNum(purchase.pricePerKg),
          );
        }
        await this.updateStockBalance(tx, tenantId, categoryId, newWeight, newAvg);

        if (valueDelta !== 0) {
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: { balanceKes: { increment: valueDelta } },
          });
        }

        await tx.purchase.update({
          where: { id: purchase.id },
          data: { correctionApplied: true },
        });
      } else {
        const sale = await tx.sale.findFirst({
          where: { id: input.targetId, tenantId },
        });
        if (!sale) {
          throw new NotFoundException('Sale not found');
        }
        categoryId = sale.categoryId;

        const stock = await this.lockStockBalance(tx, tenantId, categoryId);
        if (projectedStockKg(stock.weightKg, weightDelta) < 0) {
          throw new CorrectionWouldBreakStockException();
        }

        const newWeight = projectedStockKg(stock.weightKg, weightDelta);
        await this.updateStockBalance(
          tx,
          tenantId,
          categoryId,
          newWeight,
          stock.averageCostPerKg,
        );

        if (valueDelta !== 0) {
          await tx.buyer.update({
            where: { id: sale.buyerId },
            data: { balanceKes: { increment: valueDelta } },
          });
        }

        await tx.sale.update({
          where: { id: sale.id },
          data: { correctionApplied: true },
        });
      }

      const correction = await tx.correction.create({
        data: {
          tenantId,
          targetType: input.targetType as CorrectableType,
          targetId: input.targetId,
          weightDeltaKg: weightDelta,
          valueDeltaKes: valueDelta,
          reason: input.reason,
          createdBy: user.userId,
        },
      });

      const movementType =
        input.targetType === 'PURCHASE'
          ? StockMovementType.PURCHASE_CORRECTION
          : StockMovementType.SALE_CORRECTION;

      await this.recordMovement(tx, {
        tenantId,
        categoryId,
        movementType,
        weightDeltaKg: weightDelta,
        valueDeltaKes: valueDelta,
        referenceType: 'correction',
        referenceId: correction.id,
        createdBy: user.userId,
      });

      await this.ledgerEvents.emit(tx, {
        tenantId,
        eventType:
          input.targetType === 'PURCHASE' ? 'PURCHASE_CORRECTED' : 'SALE_CORRECTED',
        actorId: user.userId,
        referenceType: 'correction',
        referenceId: correction.id,
        payload: {
          correction_id: correction.id,
          target_type: input.targetType,
          target_id: input.targetId,
          weight_delta_kg: weightDelta,
          value_delta_kes: valueDelta,
        },
      });

      await this.audit.log({
        tenantId,
        userId: user.userId,
        action: 'correction:create',
        entityType: 'correction',
        entityId: correction.id,
      });

      return correction;
    }, LEDGER_TRANSACTION_OPTIONS);
  }

  async createStockAdjustment(user: AuthUser, body: unknown) {
    const parsed = createStockAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = this.requireTenant(user);
    const input = parsed.data;

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.scrapCategory.findFirst({
        where: { id: input.categoryId, tenantId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }

      const stock = await this.lockStockBalance(tx, tenantId, input.categoryId);
      if (projectedStockKg(stock.weightKg, input.weightDeltaKg) < 0) {
        throw new CorrectionWouldBreakStockException();
      }

      const newWeight = projectedStockKg(stock.weightKg, input.weightDeltaKg);
      await this.updateStockBalance(
        tx,
        tenantId,
        input.categoryId,
        newWeight,
        stock.averageCostPerKg,
      );

      const adjustment = await tx.stockAdjustment.create({
        data: {
          tenantId,
          categoryId: input.categoryId,
          weightDeltaKg: input.weightDeltaKg,
          reason: input.reason,
          createdBy: user.userId,
        },
      });

      await this.recordMovement(tx, {
        tenantId,
        categoryId: input.categoryId,
        movementType: StockMovementType.STOCK_ADJUSTMENT,
        weightDeltaKg: input.weightDeltaKg,
        valueDeltaKes: 0,
        referenceType: 'stock_adjustment',
        referenceId: adjustment.id,
        createdBy: user.userId,
      });

      await this.ledgerEvents.emit(tx, {
        tenantId,
        eventType: 'STOCK_ADJUSTED',
        actorId: user.userId,
        referenceType: 'stock_adjustment',
        referenceId: adjustment.id,
        payload: {
          adjustment_id: adjustment.id,
          weight_delta_kg: input.weightDeltaKg,
        },
      });

      await this.audit.log({
        tenantId,
        userId: user.userId,
        action: 'inventory:adjust',
        entityType: 'stock_adjustment',
        entityId: adjustment.id,
      });

      return adjustment;
    }, LEDGER_TRANSACTION_OPTIONS);
  }

  private requireTenant(user: AuthUser): string {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    return user.tenantId;
  }

  private async assertPartyAndCategory(
    tx: Tx,
    tenantId: string,
    partyId: string,
    categoryId: string,
    partyType: 'supplier' | 'buyer',
  ) {
    const category = await tx.scrapCategory.findFirst({
      where: { id: categoryId, tenantId, isActive: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (partyType === 'supplier') {
      const supplier = await tx.supplier.findFirst({
        where: { id: partyId, tenantId, isActive: true },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
    } else {
      const buyer = await tx.buyer.findFirst({
        where: { id: partyId, tenantId, isActive: true },
      });
      if (!buyer) {
        throw new NotFoundException('Buyer not found');
      }
    }
  }

  private async ensureStockBalanceRow(tx: Tx, tenantId: string, categoryId: string) {
    try {
      await tx.stockBalance.upsert({
        where: { tenantId_categoryId: { tenantId, categoryId } },
        create: {
          tenantId,
          categoryId,
          weightKg: 0,
          averageCostPerKg: 0,
        },
        update: {},
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }

  private async lockStockBalance(
    tx: Tx,
    tenantId: string,
    categoryId: string,
  ): Promise<LockedStock> {
    await this.ensureStockBalanceRow(tx, tenantId, categoryId);

    const rows = await tx.$queryRaw<LockedStock[]>`
      SELECT
        tenant_id AS "tenantId",
        category_id AS "categoryId",
        weight_kg AS "weightKg",
        average_cost_per_kg AS "averageCostPerKg"
      FROM stock_balances
      WHERE tenant_id = ${tenantId}::uuid
        AND category_id = ${categoryId}::uuid
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Stock balance not found');
    }

    return {
      tenantId: row.tenantId,
      categoryId: row.categoryId,
      weightKg: toNum(row.weightKg as unknown as { toString(): string }),
      averageCostPerKg: toNum(row.averageCostPerKg as unknown as { toString(): string }),
    };
  }

  private async updateStockBalance(
    tx: Tx,
    tenantId: string,
    categoryId: string,
    weightKg: number,
    averageCostPerKg: number,
  ) {
    if (roundWeight(weightKg) < 0) {
      throw new StockInsufficientException();
    }

    await tx.stockBalance.update({
      where: { tenantId_categoryId: { tenantId, categoryId } },
      data: {
        weightKg,
        averageCostPerKg,
      },
    });
  }

  private async recordMovement(
    tx: Tx,
    params: {
      tenantId: string;
      categoryId: string;
      movementType: StockMovementType;
      weightDeltaKg: number;
      valueDeltaKes: number;
      referenceType: string;
      referenceId: string;
      createdBy: string;
    },
  ) {
    return tx.stockMovement.create({
      data: {
        tenantId: params.tenantId,
        categoryId: params.categoryId,
        movementType: params.movementType,
        weightDeltaKg: params.weightDeltaKg,
        valueDeltaKes: params.valueDeltaKes,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        createdBy: params.createdBy,
      },
    });
  }
}
