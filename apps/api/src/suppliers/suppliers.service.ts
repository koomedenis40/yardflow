import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { createSupplierSchema } from '@yardflow/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return supplier;
  }
}
