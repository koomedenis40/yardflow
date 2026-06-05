import { PrismaClient, UserTenantRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_SCRAP_CATEGORIES } from '@yardflow/types';

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

async function seedCategories(tenantId: string): Promise<void> {
  await prisma.scrapCategory.createMany({
    data: DEFAULT_SCRAP_CATEGORIES.map((name, index) => ({
      tenantId,
      name,
      sortOrder: index,
      defaultBuyingPricePerKg: 0,
      defaultSellingPricePerKg: 0,
    })),
  });
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@yardflow.local' },
    update: {},
    create: {
      fullName: 'Platform Admin',
      email: 'admin@yardflow.local',
      passwordHash,
      isPlatformAdmin: true,
    },
  });

  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-yard' },
    update: {},
    create: {
      name: 'Demo Yard',
      slug: 'demo-yard',
      status: 'active',
      receiptPrefix: 'DEMO',
    },
  });

  const otherTenant = await prisma.tenant.upsert({
    where: { slug: 'other-yard' },
    update: {},
    create: {
      name: 'Other Yard',
      slug: 'other-yard',
      status: 'active',
      receiptPrefix: 'OTHR',
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.local' },
    update: {},
    create: {
      fullName: 'Demo Owner',
      email: 'owner@demo.local',
      passwordHash,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@demo.local' },
    update: {},
    create: {
      fullName: 'Demo Cashier',
      email: 'cashier@demo.local',
      passwordHash,
    },
  });

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: demoTenant.id } },
    update: { role: UserTenantRole.owner, isActive: true },
    create: {
      userId: owner.id,
      tenantId: demoTenant.id,
      role: UserTenantRole.owner,
    },
  });

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: cashier.id, tenantId: demoTenant.id } },
    update: { role: UserTenantRole.cashier, isActive: true },
    create: {
      userId: cashier.id,
      tenantId: demoTenant.id,
      role: UserTenantRole.cashier,
    },
  });

  const demoCategoryCount = await prisma.scrapCategory.count({
    where: { tenantId: demoTenant.id },
  });
  if (demoCategoryCount === 0) {
    await seedCategories(demoTenant.id);
  }

  const otherCategoryCount = await prisma.scrapCategory.count({
    where: { tenantId: otherTenant.id },
  });
  if (otherCategoryCount === 0) {
    await seedCategories(otherTenant.id);
  }

  console.log('Seed complete:', {
    platformAdmin: platformAdmin.email,
    demoTenant: demoTenant.slug,
    otherTenant: otherTenant.slug,
    owner: owner.email,
    cashier: cashier.email,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
