import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantMembershipGuard } from '../../common/guards/tenant-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '@yardflow/types';
import { MpesaPaymentIntentService } from '../services/mpesa-payment-intent.service';

@Controller('mpesa')
export class MpesaController {
  constructor(private readonly intents: MpesaPaymentIntentService) {}

  @Post('stk-push')
  @UseGuards(TenantMembershipGuard, PermissionsGuard)
  @RequirePermissions('buyer_payment:create')
  initiateStkPush(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.intents.initiateStkPush(user, body);
  }

  @Get('intents/:id/status')
  @UseGuards(TenantMembershipGuard, PermissionsGuard)
  @RequirePermissions('payment:view')
  getIntentStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.intents.getIntentStatus(user, id);
  }

  @Post('stk-callback')
  @Public()
  async stkCallback(@Body() body: unknown) {
    await this.intents.logCallback(body);
    return { ResultCode: 0, ResultDesc: 'Success' };
  }
}
