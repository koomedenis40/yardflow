import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { SupplierPaymentsService } from './supplier-payments.service';

@Controller('supplier-payments')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class SupplierPaymentsController {
  constructor(private readonly supplierPaymentsService: SupplierPaymentsService) {}

  @Post()
  @RequirePermissions('supplier_payment:create')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.supplierPaymentsService.create(user, body);
  }

  @Get()
  @RequirePermissions('payment:view')
  list(@CurrentUser() user: AuthUser) {
    return this.supplierPaymentsService.list(user);
  }

  @Get(':id')
  @RequirePermissions('payment:view')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.supplierPaymentsService.getById(user, id);
  }
}
