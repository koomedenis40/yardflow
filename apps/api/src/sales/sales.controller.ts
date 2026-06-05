import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermissions('sale:view')
  list(@CurrentUser() user: AuthUser) {
    return this.salesService.list(user);
  }

  @Get(':id')
  @RequirePermissions('sale:view')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.getById(user, id);
  }

  @Post()
  @RequirePermissions('sale:create')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.salesService.create(user, body);
  }
}
