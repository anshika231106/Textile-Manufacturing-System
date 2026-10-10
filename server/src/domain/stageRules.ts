export type Stage = 'SPINNING' | 'WEAVING' | 'DYEING';

export type LoggedByStage = Record<Stage, number>;

export interface StageRuleViolation {
  code: 'ORDER_NOT_STARTED' | 'STAGE_NOT_READY' | 'EXCEEDS_PREVIOUS_STAGE';
  message: string;
  details?: Record<string, unknown>;
}

export const PREVIOUS_STAGE: Record<Stage, Stage | null> = {
  SPINNING: null,
  WEAVING: 'SPINNING',
  DYEING: 'WEAVING',
};

/**
 * MVP Section 14.3 stage rules: SPINNING may start once the order is started;
 * WEAVING requires logged spinning output above 0; DYEING requires logged weaving output above 0.
 */
export function checkCanStartStage(stage: Stage, orderStarted: boolean, logged: LoggedByStage): StageRuleViolation | null {
  if (!orderStarted) {
    return { code: 'ORDER_NOT_STARTED', message: 'Start production on this order before starting a stage job' };
  }
  const previous = PREVIOUS_STAGE[stage];
  if (previous && !(logged[previous] > 0)) {
    return {
      code: 'STAGE_NOT_READY',
      message: `${stage} cannot start until ${previous} output has been logged for this order`,
      details: { previousStage: previous },
    };
  }
  return null;
}

/**
 * With the stage cap on, cumulative output of a stage may not exceed the previous stage's output.
 */
export function checkStageCap(stage: Stage, metres: number, logged: LoggedByStage): StageRuleViolation | null {
  const previous = PREVIOUS_STAGE[stage];
  if (!previous) return null;
  const cumulative = logged[stage] + metres;
  if (cumulative > logged[previous] + 1e-6) {
    return {
      code: 'EXCEEDS_PREVIOUS_STAGE',
      message: `${stage} output would exceed ${previous} output for this order`,
      details: {
        previousStage: previous,
        previousStageMetres: logged[previous],
        loggedMetres: logged[stage],
        remainingMetres: Math.max(logged[previous] - logged[stage], 0),
      },
    };
  }
  return null;
}
