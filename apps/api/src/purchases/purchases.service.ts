import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { LedgerTransactionService } from '../ledger/ledger-transaction.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerTransactionService,
  ) {}

  create(user: AuthUser, body: unknown) {
    return this.ledger.createPurchase(user, body);
  }

  list(user: AuthUser) {
    return this.prisma.purchase.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getById(user: AuthUser, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    return purchase;
  }
}
