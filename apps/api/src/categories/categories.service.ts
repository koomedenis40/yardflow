import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { createCategorySchema, updateCategorySchema } from '@yardflow/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(user: AuthUser): string {
    if (!user.tenantId) {
      throw new NotFoundException('Tenant context required');
    }
    return user.tenantId;
  }

  listForTenant(user: AuthUser, includeInactive = false) {
    const tenantId = this.requireTenantId(user);
    return this.prisma.scrapCategory.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async getByIdForTenant(user: AuthUser, id: string) {
    const tenantId = this.requireTenantId(user);
    const category = await this.prisma.scrapCategory.findFirst({
      where: { id, tenantId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(user: AuthUser, body: unknown) {
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = this.requireTenantId(user);
    const maxSort = await this.prisma.scrapCategory.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    return this.prisma.scrapCategory.create({
      data: {
        tenantId,
        name: parsed.data.name,
        defaultBuyingPricePerKg: parsed.data.defaultBuyingPricePerKg,
        defaultSellingPricePerKg: parsed.data.defaultSellingPricePerKg,
        sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async update(user: AuthUser, id: string, body: unknown) {
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const tenantId = this.requireTenantId(user);
    const existing = await this.prisma.scrapCategory.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    return this.prisma.scrapCategory.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.defaultBuyingPricePerKg !== undefined
          ? { defaultBuyingPricePerKg: parsed.data.defaultBuyingPricePerKg }
          : {}),
        ...(parsed.data.defaultSellingPricePerKg !== undefined
          ? { defaultSellingPricePerKg: parsed.data.defaultSellingPricePerKg }
          : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });
  }
}
