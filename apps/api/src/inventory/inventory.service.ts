import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { LedgerTransactionService } from '../ledger/ledger-transaction.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerTransactionService,
  ) {}

  listBalances(user: AuthUser) {
    return this.prisma.stockBalance.findMany({
      where: { tenantId: user.tenantId! },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { category: { sortOrder: 'asc' } },
    });
  }

  listMovements(user: AuthUser) {
    return this.prisma.stockMovement.findMany({
      where: { tenantId: user.tenantId! },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  createAdjustment(user: AuthUser, body: unknown) {
    return this.ledger.createStockAdjustment(user, body);
  }
}
