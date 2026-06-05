import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@yardflow/types';

export const SKIP_TENANT_GUARD_KEY = 'skipTenantGuard';
export const SkipTenantGuard = () => SetMetadata(SKIP_TENANT_GUARD_KEY, true);

/** Ensures tenant-scoped routes have tenantId from JWT — never from request body. */
@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    return true;
  }
}
