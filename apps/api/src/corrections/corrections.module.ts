import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { CorrectionsController } from './corrections.controller';
import { CorrectionsService } from './corrections.service';

@Module({
  imports: [LedgerModule],
  controllers: [CorrectionsController],
  providers: [CorrectionsService],
})
export class CorrectionsModule {}
