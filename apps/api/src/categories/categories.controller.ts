import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  list(
    @CurrentUser() user: AuthUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.categoriesService.listForTenant(user, includeInactive === 'true');
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATEGORY_VIEW)
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.categoriesService.getByIdForTenant(user, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATEGORY_CREATE)
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.categoriesService.create(user, body);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATEGORY_UPDATE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.categoriesService.update(user, id, body);
  }
}
