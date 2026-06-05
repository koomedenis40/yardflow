import { Prisma } from '@prisma/client';

/** ReadCommitted + row locks (FOR UPDATE) — avoids Serializable 40001 on concurrent oversell tests. */
export const LEDGER_TRANSACTION_OPTIONS: {
  isolationLevel: Prisma.TransactionIsolationLevel;
  maxWait: number;
  timeout: number;
} = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5000,
  timeout: 15000,
};
