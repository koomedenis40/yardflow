import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@yardflow/types';
import { PrismaService } from '../../prisma/prisma.service';
import { SKIP_TENANT_GUARD_KEY } from './tenant-membership.guard';

/** Blocks all tenant-scoped operations when the tenant is suspended. */
@Injectable()
export class NotSuspendedGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    // Public routes (no user) and platform admin (no tenantId) pass through.
    if (!user || !user.tenantId) return true;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { status: true },
    });

    if (tenant?.status === 'suspended') {
      throw new ForbiddenException(
        'This tenant account has been suspended. Please contact support.',
      );
    }

    return true;
  }
}
