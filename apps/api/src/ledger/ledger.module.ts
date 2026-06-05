import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LedgerEventsService } from './ledger-events.service';
import { LedgerTransactionService } from './ledger-transaction.service';
import { PaymentAllocationService } from './payment-allocation.service';

@Module({
  imports: [AuditModule],
  providers: [LedgerTransactionService, LedgerEventsService, PaymentAllocationService],
  exports: [LedgerTransactionService, LedgerEventsService, PaymentAllocationService],
})
export class LedgerModule {}
