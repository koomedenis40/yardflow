import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LedgerEventsService } from './ledger-events.service';
import { LedgerTransactionService } from './ledger-transaction.service';

@Module({
  imports: [AuditModule],
  providers: [LedgerTransactionService, LedgerEventsService],
  exports: [LedgerTransactionService, LedgerEventsService],
})
export class LedgerModule {}
