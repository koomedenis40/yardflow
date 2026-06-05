import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { PaymentAllocationService } from '../ledger/payment-allocation.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentAllocationService,
  ) {}

  create(user: AuthUser, body: unknown) {
    return this.payments.createSupplierPayment(user, body);
  }

  list(user: AuthUser) {
    return this.prisma.supplierPayment.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getById(user: AuthUser, id: string) {
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { supplier: true },
    });
    if (!payment) {
      throw new NotFoundException('Supplier payment not found');
    }
    return this.payments.enrichSupplierPayment(payment);
  }
}
