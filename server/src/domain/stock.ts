import { round3 } from '../lib/numbers';

export interface YarnStockParameters {
  onHandKg: number;
  reservedKg: number;
  reorderLevelKg: number;
}

export interface ComputedYarnStock {
  availableKg: number;
  shortfallKg: number;
  isLow: boolean;
}

/**
 * Computes available kg, shortfall kg, and low-stock warning flag.
 * 
 * Rules (MVP Section 8.4 / API-15):
 * - availableKg = max(onHandKg - reservedKg, 0)
 * - shortfallKg = max(reservedKg - onHandKg, 0)
 * - isLow = (onHandKg - reservedKg) < reorderLevelKg
 */
export function computeYarnStock(params: YarnStockParameters): ComputedYarnStock {
  const { onHandKg, reservedKg, reorderLevelKg } = params;
  const netKg = onHandKg - reservedKg;

  const availableKg = round3(Math.max(netKg, 0));
  const shortfallKg = round3(Math.max(-netKg, 0));
  const isLow = netKg < reorderLevelKg;

  return {
    availableKg,
    shortfallKg,
    isLow,
  };
}
