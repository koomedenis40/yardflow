import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_SCRAP_CATEGORIES } from '@yardflow/types';
import { slugify } from '@yardflow/utils';
import { PrismaService } from '../prisma/prisma.service';

interface CreateTenantInput {
  name: string;
  slug?: string;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        timezone: true,
        currency: true,
        receiptPrefix: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(input: CreateTenantInput) {
    const slug = input.slug?.trim() || slugify(input.name);
    if (!slug) {
      throw new BadRequestException('Unable to derive tenant slug');
    }

    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException('Tenant slug already exists');
    }

    const receiptPrefix = slug
      .split('-')
      .map((part) => part.slice(0, 3).toUpperCase())
      .join('')
      .slice(0, 6) || 'YRD';

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.name.trim(),
          slug,
          status: 'trial',
          receiptPrefix,
        },
      });

      await tx.scrapCategory.createMany({
        data: DEFAULT_SCRAP_CATEGORIES.map((name, index) => ({
          tenantId: tenant.id,
          name,
          sortOrder: index,
          defaultBuyingPricePerKg: 0,
          defaultSellingPricePerKg: 0,
        })),
      });

      return tenant;
    });
  }
}
