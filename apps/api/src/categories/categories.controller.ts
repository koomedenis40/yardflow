import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@yardflow/types';
import type { AuthUser } from '@yardflow/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantMembershipGuard } from '../common/guards/tenant-membership.guard';
import { CategoriesService } from './categories.service';

@Controller('categories')
@UseGuards(TenantMembershipGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATEGORY_VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.categoriesService.listForTenant(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATEGORY_VIEW)
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.categoriesService.getByIdForTenant(user, id);
  }
}
