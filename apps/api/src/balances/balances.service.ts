import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import type { AuthUser } from '@yardflow/types';
import { PaymentAllocationService } from '../ledger/payment-allocation.service';
import { remainingKes, toNum } from '../ledger/ledger-math';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentAllocationService,
  ) {}

  async summary(user: AuthUser) {
    const tenantId = user.tenantId!;
    const [supplierAgg, buyerAgg] = await Promise.all([
      this.prisma.supplier.aggregate({
        where: { tenantId, isActive: true },
        _sum: { balanceKes: true, creditBalanceKes: true },
      }),
      this.prisma.buyer.aggregate({
        where: { tenantId, isActive: true },
        _sum: { balanceKes: true },
      }),
    ]);

    return {
      supplierOwedKes: toNum(supplierAgg._sum.balanceKes ?? 0),
      supplierCreditKes: toNum(supplierAgg._sum.creditBalanceKes ?? 0),
      buyerReceivableKes: toNum(buyerAgg._sum.balanceKes ?? 0),
    };
  }

  supplierBalances(user: AuthUser) {
    return this.prisma.supplier.findMany({
      where: { tenantId: user.tenantId!, isActive: true },
      select: {
        id: true,
        name: true,
        balanceKes: true,
        creditBalanceKes: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  buyerBalances(user: AuthUser) {
    return this.prisma.buyer.findMany({
      where: { tenantId: user.tenantId!, isActive: true },
      select: {
        id: true,
        name: true,
        balanceKes: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async supplierOutstanding(user: AuthUser, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: user.tenantId! },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const purchases = await this.prisma.purchase.findMany({
      where: {
        tenantId: user.tenantId!,
        supplierId,
        paymentStatus: { in: [PaymentStatus.unpaid, PaymentStatus.partial] },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      purchases.map(async (purchase) => {
        const paidAmountKes = await this.payments.getPaidAmountForPurchase(purchase.id);
        const totalValueKes = toNum(purchase.totalValueKes);
        return {
          ...purchase,
          paidAmountKes,
          remainingKes: remainingKes(totalValueKes, paidAmountKes),
        };
      }),
    );
  }

  async buyerOutstanding(user: AuthUser, buyerId: string) {
    const buyer = await this.prisma.buyer.findFirst({
      where: { id: buyerId, tenantId: user.tenantId! },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId: user.tenantId!,
        buyerId,
        paymentStatus: { in: [PaymentStatus.unpaid, PaymentStatus.partial] },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      sales.map(async (sale) => {
        const paidAmountKes = await this.payments.getPaidAmountForSale(sale.id);
        const totalValueKes = toNum(sale.totalValueKes);
        return {
          ...sale,
          paidAmountKes,
          remainingKes: remainingKes(totalValueKes, paidAmountKes),
        };
      }),
    );
  }
}
