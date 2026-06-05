import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { LedgerTransactionService } from '../ledger/ledger-transaction.service';
import { PaymentAllocationService } from '../ledger/payment-allocation.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerTransactionService,
    private readonly payments: PaymentAllocationService,
  ) {}

  create(user: AuthUser, body: unknown) {
    return this.ledger.createSale(user, body);
  }

  list(user: AuthUser) {
    return this.prisma.sale.findMany({
      where: { tenantId: user.tenantId! },
      include: {
        buyer: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getById(user: AuthUser, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return this.payments.enrichSale(sale);
  }
}
