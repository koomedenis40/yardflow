import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NotSuspendedGuard } from '../src/common/guards/not-suspended.guard';
import { SKIP_TENANT_GUARD_KEY } from '../src/common/guards/tenant-membership.guard';

function buildContext(user: unknown, handlerMeta?: boolean, classMeta?: boolean) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
    if (key === SKIP_TENANT_GUARD_KEY) {
      return handlerMeta ?? classMeta ?? false;
    }
    return undefined;
  });
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
  return { reflector, ctx };
}

describe('NotSuspendedGuard', () => {
  it('allows when SkipTenantGuard is set', async () => {
    const prisma = { tenant: { findUnique: jest.fn() } } as never;
    const { reflector, ctx } = buildContext(null, true);
    const guard = new NotSuspendedGuard(prisma, reflector);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('allows when request.user is undefined (public route)', async () => {
    const prisma = { tenant: { findUnique: jest.fn() } } as never;
    const { reflector, ctx } = buildContext(undefined);
    const guard = new NotSuspendedGuard(prisma, reflector);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows when user has no tenantId (platform admin)', async () => {
    const prisma = { tenant: { findUnique: jest.fn() } } as never;
    const { reflector, ctx } = buildContext({ tenantId: null });
    const guard = new NotSuspendedGuard(prisma, reflector);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows when tenant status is active', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ status: 'active' }) },
    } as never;
    const { reflector, ctx } = buildContext({ tenantId: 'tenant-1' });
    const guard = new NotSuspendedGuard(prisma, reflector);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows when tenant status is trial', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ status: 'trial' }) },
    } as never;
    const { reflector, ctx } = buildContext({ tenantId: 'tenant-1' });
    const guard = new NotSuspendedGuard(prisma, reflector);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws ForbiddenException when tenant is suspended', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ status: 'suspended' }) },
    } as never;
    const { reflector, ctx } = buildContext({ tenantId: 'tenant-1' });
    const guard = new NotSuspendedGuard(prisma, reflector);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows when tenant is not found (handled downstream)', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(null) },
    } as never;
    const { reflector, ctx } = buildContext({ tenantId: 'unknown-id' });
    const guard = new NotSuspendedGuard(prisma, reflector);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
