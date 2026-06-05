import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { LedgerTransactionService } from '../ledger/ledger-transaction.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerTransactionService,
  ) {}

  create(user: AuthUser, body: unknown) {
    return this.ledger.createSale(user, body);
  }

  list(user: AuthUser) {
    return this.prisma.sale.findMany({
      where: { tenantId: user.tenantId! },
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
    return sale;
  }
}
