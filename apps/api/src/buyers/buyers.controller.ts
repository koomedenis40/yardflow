import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { BuyersService } from './buyers.service';

@Controller('buyers')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class BuyersController {
  constructor(private readonly buyersService: BuyersService) {}

  @Get()
  @RequirePermissions('buyer:view')
  list(@CurrentUser() user: AuthUser) {
    return this.buyersService.list(user);
  }

  @Post()
  @RequirePermissions('buyer:create')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.buyersService.create(user, body);
  }
}
