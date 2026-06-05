import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@yardflow/types';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { SkipTenantGuard } from '../common/guards/tenant-membership.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@SkipTenantGuard()
@UseGuards(PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANT_VIEW)
  list() {
    return this.tenantsService.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PLATFORM_TENANT_CREATE)
  create(@Body() body: { name: string; slug?: string }) {
    return this.tenantsService.create(body);
  }
}
