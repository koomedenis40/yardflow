import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { BalancesService } from './balances.service';

@Controller('balances')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('summary')
  @RequirePermissions('payment:view')
  summary(@CurrentUser() user: AuthUser) {
    return this.balancesService.summary(user);
  }

  @Get('suppliers')
  @RequirePermissions('payment:view')
  suppliers(@CurrentUser() user: AuthUser) {
    return this.balancesService.supplierBalances(user);
  }

  @Get('buyers')
  @RequirePermissions('payment:view')
  buyers(@CurrentUser() user: AuthUser) {
    return this.balancesService.buyerBalances(user);
  }

  @Get('suppliers/:id/outstanding')
  @RequirePermissions('payment:view')
  supplierOutstanding(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.balancesService.supplierOutstanding(user, id);
  }

  @Get('buyers/:id/outstanding')
  @RequirePermissions('payment:view')
  buyerOutstanding(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.balancesService.buyerOutstanding(user, id);
  }
}
