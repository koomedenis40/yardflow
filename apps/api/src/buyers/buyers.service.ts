import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import type { AuthUser } from '@yardflow/types';
import { createBuyerSchema } from '@yardflow/validation';
import { PaymentAllocationService } from '../ledger/payment-allocation.service';
import { remainingKes, toNum } from '../ledger/ledger-math';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuyersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentAllocationService,
  ) {}

  list(user: AuthUser) {
    return this.prisma.buyer.findMany({
      where: { tenantId: user.tenantId!, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(user: AuthUser, body: unknown) {
    const parsed = createBuyerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.prisma.buyer.create({
      data: {
        tenantId: user.tenantId!,
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
  }

  async getById(user: AuthUser, id: string) {
    const buyer = await this.prisma.buyer.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    const [unpaidSales, recentPayments] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          tenantId: user.tenantId!,
          buyerId: id,
          paymentStatus: { in: [PaymentStatus.unpaid, PaymentStatus.partial] },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      this.prisma.buyerPayment.findMany({
        where: { tenantId: user.tenantId!, buyerId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const unpaidSalesEnriched = await Promise.all(
      unpaidSales.map(async (sale) => {
        const paidAmountKes = await this.payments.getPaidAmountForSale(sale.id);
        return {
          ...sale,
          paidAmountKes,
          remainingKes: remainingKes(toNum(sale.totalValueKes), paidAmountKes),
        };
      }),
    );

    return {
      ...buyer,
      balanceKes: toNum(buyer.balanceKes),
      unpaidSales: unpaidSalesEnriched,
      recentPayments,
    };
  }
}
