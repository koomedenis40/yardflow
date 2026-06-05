import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@yardflow/types';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('supplier:view')
  list(@CurrentUser() user: AuthUser) {
    return this.suppliersService.list(user);
  }

  @Get(':id')
  @RequirePermissions('supplier:view')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.suppliersService.getById(user, id);
  }

  @Post()
  @RequirePermissions('supplier:create')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.suppliersService.create(user, body);
  }
}
