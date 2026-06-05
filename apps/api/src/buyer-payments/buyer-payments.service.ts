import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { PaymentAllocationService } from '../ledger/payment-allocation.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuyerPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentAllocationService,
  ) {}

  create(user: AuthUser, body: unknown) {
    return this.payments.createBuyerPayment(user, body);
  }

  list(user: AuthUser) {
    return this.prisma.buyerPayment.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getById(user: AuthUser, id: string) {
    const payment = await this.prisma.buyerPayment.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { buyer: true },
    });
    if (!payment) {
      throw new NotFoundException('Buyer payment not found');
    }
    return this.payments.enrichBuyerPayment(payment);
  }
}
