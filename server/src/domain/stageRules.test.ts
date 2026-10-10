import { describe, it, expect } from 'vitest';
import { checkCanStartStage, checkStageCap } from './stageRules';

const logged = (SPINNING = 0, WEAVING = 0, DYEING = 0) => ({ SPINNING, WEAVING, DYEING });

describe('checkCanStartStage', () => {
  it('refuses any stage before the order is started', () => {
    expect(checkCanStartStage('SPINNING', false, logged())?.code).toBe('ORDER_NOT_STARTED');
  });

  it('allows SPINNING once the order is started', () => {
    expect(checkCanStartStage('SPINNING', true, logged())).toBeNull();
  });

  it('requires spinning output before WEAVING', () => {
    expect(checkCanStartStage('WEAVING', true, logged())?.code).toBe('STAGE_NOT_READY');
    expect(checkCanStartStage('WEAVING', true, logged(10))).toBeNull();
  });

  it('requires weaving output before DYEING', () => {
    expect(checkCanStartStage('DYEING', true, logged(100))?.code).toBe('STAGE_NOT_READY');
    expect(checkCanStartStage('DYEING', true, logged(100, 50))).toBeNull();
  });
});

describe('checkStageCap', () => {
  it('never caps SPINNING', () => {
    expect(checkStageCap('SPINNING', 10_000, logged())).toBeNull();
  });

  it('allows output up to the previous stage', () => {
    expect(checkStageCap('WEAVING', 400, logged(400))).toBeNull();
    expect(checkStageCap('DYEING', 20, logged(400, 380, 360))).toBeNull();
  });

  it('refuses cumulative output above the previous stage', () => {
    const v = checkStageCap('WEAVING', 100, logged(400, 380));
    expect(v?.code).toBe('EXCEEDS_PREVIOUS_STAGE');
    expect(v?.details?.remainingMetres).toBe(20);
    expect(checkStageCap('DYEING', 21, logged(400, 380, 360))?.code).toBe('EXCEEDS_PREVIOUS_STAGE');
  });
});
