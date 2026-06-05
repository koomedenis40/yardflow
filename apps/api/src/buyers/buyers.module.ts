import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { BuyersController } from './buyers.controller';
import { BuyersService } from './buyers.service';

@Module({
  imports: [LedgerModule],
  controllers: [BuyersController],
  providers: [BuyersService],
  exports: [BuyersService],
})
export class BuyersModule {}
