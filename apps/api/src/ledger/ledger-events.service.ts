import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class LedgerEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(
    tx: Tx,
    params: {
      tenantId: string;
      eventType: string;
      payload: Record<string, unknown>;
      actorId?: string;
      referenceType?: string;
      referenceId?: string;
    },
  ) {
    return tx.ledgerEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: params.eventType,
        payload: params.payload as Prisma.InputJsonValue,
        actorId: params.actorId ?? null,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
      },
    });
  }
}
