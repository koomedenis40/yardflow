import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @RequirePermissions('purchase:view')
  list(@CurrentUser() user: AuthUser) {
    return this.purchasesService.list(user);
  }

  @Get(':id')
  @RequirePermissions('purchase:view')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchasesService.getById(user, id);
  }

  @Post()
  @RequirePermissions('purchase:create')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.purchasesService.create(user, body);
  }
}
