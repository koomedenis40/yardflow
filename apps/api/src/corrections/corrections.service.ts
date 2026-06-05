import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { LedgerTransactionService } from '../ledger/ledger-transaction.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CorrectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerTransactionService,
  ) {}

  create(user: AuthUser, body: unknown) {
    return this.ledger.createCorrection(user, body);
  }

  list(user: AuthUser) {
    return this.prisma.correction.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
