import { Controller, Get, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@yardflow/types';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.auditService.listForTenant(user);
  }
}
