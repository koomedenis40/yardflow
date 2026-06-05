import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions('inventory:view')
  listBalances(@CurrentUser() user: AuthUser) {
    return this.inventoryService.listBalances(user);
  }

  @Get('movements')
  @RequirePermissions('inventory:view')
  listMovements(@CurrentUser() user: AuthUser) {
    return this.inventoryService.listMovements(user);
  }

  @Post('adjustments')
  @RequirePermissions('inventory:adjust')
  createAdjustment(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.inventoryService.createAdjustment(user, body);
  }
}
