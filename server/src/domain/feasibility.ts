import { round3 } from '../lib/numbers';

export interface FeasibilityYarnRequirement {
  yarnTypeId: string;
  requiredKg: number;
}

export interface StockAvailability {
  onHandKg: number;
  reservedByOthersKg: number;
  availableKg: number;
}

export interface EvaluatedFeasibilityLine {
  yarnTypeId: string;
  requiredKg: number;
  onHandKg: number;
  reservedByOthersKg: number;
  availableKg: number;
  shortfallKg: number;
  isSufficient: boolean;
}

export interface FeasibilityAssessment {
  canStart: boolean;
  isFeasible: boolean;
  lines: EvaluatedFeasibilityLine[];
}

/**
 * Pure function to evaluate yarn stock feasibility for an order or prospective order.
 */
export function evaluateFeasibility(
  requirements: FeasibilityYarnRequirement[],
  stockMap: Map<string, StockAvailability>
): FeasibilityAssessment {
  const evaluatedLines: EvaluatedFeasibilityLine[] = [];
  let allSufficient = true;

  for (const req of requirements) {
    const stock = stockMap.get(req.yarnTypeId) || {
      onHandKg: 0,
      reservedByOthersKg: 0,
      availableKg: 0,
    };

    const requiredKg = round3(req.requiredKg);
    const availableKg = round3(stock.availableKg);
    const shortfallKg = round3(Math.max(requiredKg - availableKg, 0));
    const isSufficient = shortfallKg === 0;

    if (!isSufficient) {
      allSufficient = false;
    }

    evaluatedLines.push({
      yarnTypeId: req.yarnTypeId,
      requiredKg,
      onHandKg: round3(stock.onHandKg),
      reservedByOthersKg: round3(stock.reservedByOthersKg),
      availableKg,
      shortfallKg,
      isSufficient,
    });
  }

  return {
    canStart: allSufficient,
    isFeasible: allSufficient,
    lines: evaluatedLines,
  };
}
