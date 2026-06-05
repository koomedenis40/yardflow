import { existsSync } from 'fs';
import { resolve } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { config as loadEnv } from 'dotenv';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

describe('YardFlow API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const login = async (email: string, tenantSlug?: string) => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email,
        password: 'Password123!',
        ...(tenantSlug ? { tenantSlug } : {}),
      })
      .expect(201);
    return res.body as { accessToken: string; refreshToken: string; user: { permissions: string[] } };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('owner login works', async () => {
    const session = await login('owner@demo.local', 'demo-yard');
    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toBeDefined();
  });

  it('cashier login works', async () => {
    const session = await login('cashier@demo.local', 'demo-yard');
    expect(session.accessToken).toBeDefined();
  });

  it('platform admin login works', async () => {
    const session = await login('admin@yardflow.local');
    expect(session.accessToken).toBeDefined();
  });

  it('owner receives owner permissions', async () => {
    const session = await login('owner@demo.local', 'demo-yard');
    expect(session.user.permissions).toContain('report:view');
    expect(session.user.permissions).toContain('audit:view');
  });

  it('cashier does not receive owner-only permissions', async () => {
    const session = await login('cashier@demo.local', 'demo-yard');
    expect(session.user.permissions).not.toContain('report:view');
    expect(session.user.permissions).not.toContain('audit:view');
  });

  it('owner can list 12 categories', async () => {
    const session = await login('owner@demo.local', 'demo-yard');
    const res = await request(app.getHttpServer())
      .get('/v1/categories')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);
  });

  it('cashier can list categories', async () => {
    const session = await login('cashier@demo.local', 'demo-yard');
    await request(app.getHttpServer())
      .get('/v1/categories')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
  });

  it('unauthenticated category access is blocked', async () => {
    await request(app.getHttpServer()).get('/v1/categories').expect(401);
  });

  it('cashier blocked from report/audit probe', async () => {
    const session = await login('cashier@demo.local', 'demo-yard');
    await request(app.getHttpServer())
      .get('/v1/users/reports-access')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/audit/logs')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(403);
  });

  it('owner allowed report/audit probe', async () => {
    const session = await login('owner@demo.local', 'demo-yard');
    await request(app.getHttpServer())
      .get('/v1/users/reports-access')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/audit/logs')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
  });

  it('platform admin can list tenants', async () => {
    const session = await login('admin@yardflow.local');
    const res = await request(app.getHttpServer())
      .get('/v1/tenants')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('cross-tenant category access blocked', async () => {
    const ownerSession = await login('owner@demo.local', 'demo-yard');
    const otherCategory = await prisma.scrapCategory.findFirst({
      where: { tenant: { slug: 'other-yard' } },
    });
    expect(otherCategory).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/v1/categories/${otherCategory!.id}`)
      .set('Authorization', `Bearer ${ownerSession.accessToken}`)
      .expect(404);
  });
});
