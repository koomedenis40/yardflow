/**
 * Realistic demo data seed for the `demo-yard` tenant.
 *
 * Strategy:
 *   - Prisma (direct) clears the demo tenant's transactional data, creates
 *     realistic suppliers/buyers, and sets believable category pricing.
 *   - The running API (HTTP) records purchases / sales / payments so stock,
 *     weighted-average COGS, FIFO allocation, and balances are all computed by
 *     production code — never hand-rolled.
 *
 * Prerequisite: the API dev server must be running (pnpm dev), reachable at
 * API_BASE below. Idempotent — safe to re-run; it resets demo data each time.
 *
 * Run:  pnpm --filter @yardflow/api run seed:demo
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_BASE = process.env.SEED_API_BASE ?? 'http://localhost:3001/v1';
const TENANT_SLUG = 'demo-yard';
const OWNER_EMAIL = 'owner@demo.local';
const OWNER_PASSWORD = 'Password123!';

const SUPPLIERS = [
  { name: 'Mary Wanjiku', phone: '0712345001' },
  { name: 'Peter Otieno', phone: '0712345002' },
  { name: 'James Mwangi', phone: '0712345003' },
  { name: 'Amina Hassan', phone: '0712345004' },
  { name: 'Brian Kiptoo', phone: '0712345005' },
  { name: 'Grace Njeri', phone: '0712345006' },
  { name: 'Samuel Kamau', phone: '0712345007' },
  { name: 'Fatuma Ali', phone: '0712345008' },
];

const BUYERS = [
  { name: 'Nairobi Metals Ltd', phone: '0720100001' },
  { name: 'Eastlands Recycling', phone: '0720100002' },
  { name: 'GreenCycle Traders', phone: '0720100003' },
  { name: 'Ruiru Scrap Buyers', phone: '0720100004' },
  { name: 'Mombasa Steel Co', phone: '0720100005' },
  { name: 'Thika Alloys Ltd', phone: '0720100006' },
];

const CATEGORY_PRICING: Record<string, { buy: number; sell: number }> = {
  'Light Steel': { buy: 25, sell: 34 },
  'Heavy Steel': { buy: 30, sell: 41 },
  Steel: { buy: 28, sell: 38 },
  'Cast Iron': { buy: 22, sell: 30 },
  Copper: { buy: 640, sell: 720 },
  Aluminium: { buy: 185, sell: 215 },
  'Soft Aluminium': { buy: 180, sell: 210 },
  'Hard Aluminium': { buy: 150, sell: 178 },
  Brass: { buy: 400, sell: 460 },
  'Stainless Steel': { buy: 95, sell: 120 },
  Lead: { buy: 120, sell: 145 },
  Plastic: { buy: 12, sell: 18 },
  'Car Batteries': { buy: 110, sell: 135 },
  Batteries: { buy: 110, sell: 135 },
};
const FALLBACK_PRICING = { buy: 30, sell: 40 };
const METHODS = ['cash', 'mobile_money_manual', 'bank'];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 86_400_000 - Math.random() * 36_000_000);
}

let token = '';
async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function main(): Promise<void> {
  // Verify API reachable.
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (!health.ok) throw new Error(String(health.status));
  } catch {
    throw new Error(`API not reachable at ${API_BASE}. Start it with "pnpm dev" first.`);
  }

  const login = await api<{ accessToken: string }>('/auth/login', {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    tenantSlug: TENANT_SLUG,
  });
  token = login.accessToken;

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — run base seed first.`);
  const scope = { where: { tenantId: tenant.id } };

  console.log('Clearing existing demo transactional data…');
  await prisma.paymentAllocation.deleteMany(scope);
  await prisma.supplierPayment.deleteMany(scope);
  await prisma.buyerPayment.deleteMany(scope);
  await prisma.stockMovement.deleteMany(scope);
  await prisma.stockAdjustment.deleteMany(scope);
  await prisma.correction.deleteMany(scope);
  await prisma.ledgerEvent.deleteMany(scope);
  await prisma.auditLog.deleteMany(scope);
  await prisma.sale.deleteMany(scope);
  await prisma.purchase.deleteMany(scope);
  await prisma.stockBalance.deleteMany(scope);
  await prisma.supplier.deleteMany(scope);
  await prisma.buyer.deleteMany(scope);

  // Realistic category prices.
  const categories = await prisma.scrapCategory.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: 'asc' },
  });
  for (const cat of categories) {
    const p = CATEGORY_PRICING[cat.name] ?? FALLBACK_PRICING;
    await prisma.scrapCategory.update({
      where: { id: cat.id },
      data: { defaultBuyingPricePerKg: p.buy, defaultSellingPricePerKg: p.sell },
    });
  }
  const tradeCats = categories.filter((c) => CATEGORY_PRICING[c.name]).slice(0, 8);
  const cats = tradeCats.length >= 4 ? tradeCats : categories.slice(0, 6);
  const priceFor = (name: string) => CATEGORY_PRICING[name] ?? FALLBACK_PRICING;

  console.log('Creating suppliers and buyers…');
  const suppliers = [];
  for (const s of SUPPLIERS) {
    suppliers.push(
      await prisma.supplier.create({ data: { tenantId: tenant.id, name: s.name, phone: s.phone } }),
    );
  }
  const buyers = [];
  for (const b of BUYERS) {
    buyers.push(
      await prisma.buyer.create({ data: { tenantId: tenant.id, name: b.name, phone: b.phone } }),
    );
  }

  console.log('Recording purchases…');
  let pSeq = 0;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i];
      const supplier = pick(suppliers, pSeq + pass);
      const base = priceFor(cat.name);
      const weightKg = round(60 + ((pSeq * 37) % 240) + pass * 25, 0);
      const pricePerKg = round(base.buy * (0.96 + (pSeq % 5) * 0.02), 2);
      const purchase = await api<{ id: string }>('/purchases', {
        supplierId: supplier.id,
        categoryId: cat.id,
        weightKg,
        pricePerKg,
        idempotencyKey: randomUUID(),
      });
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { createdAt: daysAgo(13 - pass * 3 - (i % 4)) },
      });
      pSeq++;
    }
  }

  console.log('Recording sales…');
  let sSeq = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i];
      const buyer = pick(buyers, sSeq);
      const base = priceFor(cat.name);
      const weightKg = round(30 + ((sSeq * 23) % 110), 0);
      const pricePerKg = round(base.sell * (0.98 + (sSeq % 4) * 0.015), 2);
      try {
        const sale = await api<{ id: string }>('/sales', {
          buyerId: buyer.id,
          categoryId: cat.id,
          weightKg,
          pricePerKg,
          idempotencyKey: randomUUID(),
        });
        await prisma.sale.update({
          where: { id: sale.id },
          data: { createdAt: daysAgo(6 - pass * 2 - (i % 3)) },
        });
      } catch {
        // Skip if stock insufficient for this grade — keeps seed resilient.
      }
      sSeq++;
    }
  }

  console.log('Recording payments…');
  for (let i = 0; i < suppliers.length; i++) {
    const fresh = await prisma.supplier.findUnique({ where: { id: suppliers[i].id } });
    const owed = Number(fresh?.balanceKes ?? 0);
    const factor = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.6 : 0;
    const amount = round(owed * factor, 0);
    if (amount <= 0) continue;
    const payment = await api<{ id: string }>('/supplier-payments', {
      supplierId: suppliers[i].id,
      amountKes: amount,
      paymentMethod: pick(METHODS, i),
      idempotencyKey: randomUUID(),
    });
    await prisma.supplierPayment
      .update({ where: { id: payment.id }, data: { createdAt: daysAgo(i % 5) } })
      .catch(() => undefined);
  }

  for (let i = 0; i < buyers.length; i++) {
    const fresh = await prisma.buyer.findUnique({ where: { id: buyers[i].id } });
    const receivable = Number(fresh?.balanceKes ?? 0);
    const factor = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.5 : 0;
    const amount = round(receivable * factor, 0);
    if (amount <= 0) continue;
    const payment = await api<{ id: string }>('/buyer-payments', {
      buyerId: buyers[i].id,
      amountKes: amount,
      paymentMethod: pick(METHODS, i + 1),
      idempotencyKey: randomUUID(),
    });
    await prisma.buyerPayment
      .update({ where: { id: payment.id }, data: { createdAt: daysAgo(i % 4) } })
      .catch(() => undefined);
  }

  const [supCount, buyCount, purCount, salCount] = await Promise.all([
    prisma.supplier.count(scope),
    prisma.buyer.count(scope),
    prisma.purchase.count(scope),
    prisma.sale.count(scope),
  ]);
  console.log('Demo seed complete:', {
    suppliers: supCount,
    buyers: buyCount,
    purchases: purCount,
    sales: salCount,
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
