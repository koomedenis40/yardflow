import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import type { AuthUser } from '@yardflow/types';
import { createSupplierSchema } from '@yardflow/validation';
import { PaymentAllocationService } from '../ledger/payment-allocation.service';
import { remainingKes, toNum } from '../ledger/ledger-math';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentAllocationService,
  ) {}

  list(user: AuthUser) {
    return this.prisma.supplier.findMany({
      where: { tenantId: user.tenantId!, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(user: AuthUser, body: unknown) {
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.prisma.supplier.create({
      data: {
        tenantId: user.tenantId!,
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
  }

  async getById(user: AuthUser, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const [unpaidPurchases, recentPayments] = await Promise.all([
      this.prisma.purchase.findMany({
        where: {
          tenantId: user.tenantId!,
          supplierId: id,
          paymentStatus: { in: [PaymentStatus.unpaid, PaymentStatus.partial] },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      this.prisma.supplierPayment.findMany({
        where: { tenantId: user.tenantId!, supplierId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const unpaidPurchasesEnriched = await Promise.all(
      unpaidPurchases.map(async (purchase) => {
        const paidAmountKes = await this.payments.getPaidAmountForPurchase(purchase.id);
        return {
          ...purchase,
          paidAmountKes,
          remainingKes: remainingKes(toNum(purchase.totalValueKes), paidAmountKes),
        };
      }),
    );

    return {
      ...supplier,
      balanceKes: toNum(supplier.balanceKes),
      creditBalanceKes: toNum(supplier.creditBalanceKes),
      unpaidPurchases: unpaidPurchasesEnriched,
      recentPayments,
    };
  }
}
