import type { Money } from '@yardflow/types';
import { roundMoney } from './money';

// Weighted-average cost per category per tenant (SYSTEM_RULES Sec 16).
export const newAvgCostPerKg = (
  existingKg: number,
  existingAvgCost: number,
  incomingKg: number,
  purchasePricePerKg: number,
): Money => {
  const totalKg = existingKg + incomingKg;
  if (totalKg <= 0) return 0;
  return roundMoney((existingKg * existingAvgCost + incomingKg * purchasePricePerKg) / totalKg);
};

export const computeCogs = (weightKg: number, costPerKgAtSale: number): Money =>
  roundMoney(weightKg * costPerKgAtSale);

export const computeGrossProfit = (totalSaleValueKes: number, cogsKes: number): Money =>
  roundMoney(totalSaleValueKes - cogsKes);
