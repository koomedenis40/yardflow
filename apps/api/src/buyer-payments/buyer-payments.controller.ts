import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { BuyerPaymentsService } from './buyer-payments.service';

@Controller('buyer-payments')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class BuyerPaymentsController {
  constructor(private readonly buyerPaymentsService: BuyerPaymentsService) {}

  @Post()
  @RequirePermissions('buyer_payment:create')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.buyerPaymentsService.create(user, body);
  }

  @Get()
  @RequirePermissions('payment:view')
  list(@CurrentUser() user: AuthUser) {
    return this.buyerPaymentsService.list(user);
  }

  @Get(':id')
  @RequirePermissions('payment:view')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.buyerPaymentsService.getById(user, id);
  }
}
