import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [LedgerModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
