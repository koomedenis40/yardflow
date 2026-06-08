import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MpesaController } from './controllers/mpesa.controller';
import { DarajaAuthService } from './services/daraja-auth.service';
import { DarajaStkService } from './services/daraja-stk.service';
import { MpesaPaymentIntentService } from './services/mpesa-payment-intent.service';

@Module({
  imports: [PrismaModule],
  controllers: [MpesaController],
  providers: [DarajaAuthService, DarajaStkService, MpesaPaymentIntentService],
  exports: [MpesaPaymentIntentService],
})
export class MpesaModule {}
