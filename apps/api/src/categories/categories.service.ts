import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTenant(user: AuthUser) {
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Tenant context required');
    }

    return this.prisma.scrapCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getByIdForTenant(user: AuthUser, id: string) {
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Tenant context required');
    }

    const category = await this.prisma.scrapCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
}
