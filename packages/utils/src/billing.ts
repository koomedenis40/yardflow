import type { Money, WeightKg } from '@yardflow/types';
import { roundWeight } from './weight';

// Monthly intake-based tiers (SYSTEM_RULES Sec 17). amountKes null = custom/negotiated.
export interface BillingTier {
  name: string;
  minKg: number;
  maxKg: number | null;
  amountKes: Money | null;
}

export const BILLING_TIERS: readonly BillingTier[] = [
  { name: 'Starter', minKg: 0, maxKg: 999, amountKes: 999 },
  { name: 'Growth', minKg: 1000, maxKg: 10000, amountKes: 1588 },
  { name: 'Scale', minKg: 10001, maxKg: 50000, amountKes: 3500 },
  { name: 'Custom', minKg: 50001, maxKg: null, amountKes: null },
];

export const assignBillingTier = (intakeKg: number): BillingTier => {
  const kg = roundWeight(intakeKg);
  const tier = BILLING_TIERS.find((t) => kg >= t.minKg && (t.maxKg === null || kg <= t.maxKg));
  // Defensive: negative/NaN intake falls back to the entry tier.
  return tier ?? BILLING_TIERS[0]!;
};

/** monthly_net_intake_kg = SUM(purchase weight) - SUM(negative purchase-correction weight). */
export const computeMonthlyNetIntake = (
  purchaseWeightsKg: readonly number[],
  negativeCorrectionWeightsKg: readonly number[] = [],
): WeightKg => {
  const purchased = purchaseWeightsKg.reduce((sum, w) => sum + w, 0);
  const corrected = negativeCorrectionWeightsKg.reduce((sum, w) => sum + Math.abs(w), 0);
  return roundWeight(purchased - corrected);
};
