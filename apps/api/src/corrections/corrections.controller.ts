import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { CorrectionsService } from './corrections.service';

@Controller('corrections')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class CorrectionsController {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Get()
  @RequirePermissions('purchase:view')
  list(@CurrentUser() user: AuthUser) {
    return this.correctionsService.list(user);
  }

  @Post()
  @RequirePermissions('purchase:correct', 'sale:correct')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.correctionsService.create(user, body);
  }
}
