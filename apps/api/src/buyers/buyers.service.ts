import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { createBuyerSchema } from '@yardflow/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuyersService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.buyer.findMany({
      where: { tenantId: user.tenantId!, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(user: AuthUser, body: unknown) {
    const parsed = createBuyerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.prisma.buyer.create({
      data: {
        tenantId: user.tenantId!,
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
  }

  async getById(user: AuthUser, id: string) {
    const buyer = await this.prisma.buyer.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }
    return buyer;
  }
}
