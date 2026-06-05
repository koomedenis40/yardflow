import { computeGrossProfit, computeTotalValue, newAvgCostPerKg, roundMoney, roundWeight } from '@yardflow/utils';

export const toNum = (value: { toString(): string } | number): number =>
  typeof value === 'number' ? value : Number(value);

export const calcPurchaseTotal = (weightKg: number, pricePerKg: number): number =>
  computeTotalValue(weightKg, pricePerKg);

export const calcSaleTotal = (weightKg: number, pricePerKg: number): number =>
  computeTotalValue(weightKg, pricePerKg);

export const calcWeightedAverageCost = (
  existingKg: number,
  existingAvg: number,
  incomingKg: number,
  incomingPrice: number,
): number => newAvgCostPerKg(existingKg, existingAvg, incomingKg, incomingPrice);

export const calcSaleCogs = (weightKg: number, costPerKg: number) => ({
  costPerKgAtSale: roundMoney(costPerKg),
  totalCostKes: roundMoney(weightKg * costPerKg),
  grossProfitKes: 0,
});

export const calcSaleProfit = (
  totalSaleValueKes: number,
  weightKg: number,
  costPerKg: number,
): { costPerKgAtSale: number; totalCostKes: number; grossProfitKes: number } => {
  const costPerKgAtSale = roundMoney(costPerKg);
  const totalCostKes = roundMoney(weightKg * costPerKgAtSale);
  const grossProfitKes = computeGrossProfit(totalSaleValueKes, totalCostKes);
  return { costPerKgAtSale, totalCostKes, grossProfitKes };
};

export const projectedStockKg = (currentKg: number, deltaKg: number): number =>
  roundWeight(currentKg + deltaKg);
