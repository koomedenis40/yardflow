import type { Money, UUID } from '@yardflow/types';
import { roundMoney } from './money';

// FIFO allocation with optional preferred target + credit pool remainder (SYSTEM_RULES Sec 13).
export interface AllocatableTarget {
  id: UUID;
  /** Outstanding balance on this purchase/sale. */
  remainingKes: Money;
}

export interface AllocationSlice {
  targetId: UUID;
  allocatedKes: Money;
}

export interface FifoAllocationResult {
  allocations: AllocationSlice[];
  /** Unallocated remainder -> supplier credit pool (or blocked for buyers per policy). */
  creditRemainingKes: Money;
}

/**
 * Allocate `amountKes` across `targets` (assumed oldest-first). If `preferredTargetId`
 * is provided, that target is settled first, then the remainder flows FIFO.
 */
export const allocateFifo = (
  amountKes: number,
  targets: readonly AllocatableTarget[],
  preferredTargetId?: UUID,
): FifoAllocationResult => {
  let remaining = roundMoney(amountKes);
  const allocations: AllocationSlice[] = [];

  const ordered: AllocatableTarget[] = preferredTargetId
    ? [
        ...targets.filter((t) => t.id === preferredTargetId),
        ...targets.filter((t) => t.id !== preferredTargetId),
      ]
    : [...targets];

  for (const target of ordered) {
    if (remaining <= 0) break;
    const available = Math.max(0, roundMoney(target.remainingKes));
    const slice = Math.min(remaining, available);
    if (slice > 0) {
      allocations.push({ targetId: target.id, allocatedKes: roundMoney(slice) });
      remaining = roundMoney(remaining - slice);
    }
  }

  return { allocations, creditRemainingKes: roundMoney(Math.max(0, remaining)) };
};
