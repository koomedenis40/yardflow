import { Controller, Get, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@yardflow/types';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';

@Controller('users')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class UsersController {
  /** Permission probe for report access (owner-only in R2 tests). */
  @Get('reports-access')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  reportsAccess() {
    return { allowed: true, resource: 'reports' };
  }
}
