import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { BuyerPaymentsController } from './buyer-payments.controller';
import { BuyerPaymentsService } from './buyer-payments.service';

@Module({
  imports: [LedgerModule],
  controllers: [BuyerPaymentsController],
  providers: [BuyerPaymentsService],
})
export class BuyerPaymentsModule {}
