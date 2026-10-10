import { describe, it, expect } from 'vitest';
import { evaluateFeasibility } from './feasibility';

describe('evaluateFeasibility', () => {
  it('returns canStart=true when all yarns have sufficient available stock', () => {
    const stockMap = new Map([
      ['yt_1', { onHandKg: 500, reservedByOthersKg: 100, availableKg: 400 }],
      ['yt_2', { onHandKg: 300, reservedByOthersKg: 0, availableKg: 300 }],
    ]);

    const res = evaluateFeasibility(
      [
        { yarnTypeId: 'yt_1', requiredKg: 200 },
        { yarnTypeId: 'yt_2', requiredKg: 150 },
      ],
      stockMap
    );

    expect(res.canStart).toBe(true);
    expect(res.isFeasible).toBe(true);
    expect(res.lines[0].shortfallKg).toBe(0);
    expect(res.lines[0].isSufficient).toBe(true);
    expect(res.lines[1].shortfallKg).toBe(0);
    expect(res.lines[1].isSufficient).toBe(true);
  });

  it('returns canStart=false with shortfall when stock is insufficient', () => {
    const stockMap = new Map([
      ['yt_1', { onHandKg: 150, reservedByOthersKg: 50, availableKg: 100 }],
    ]);

    const res = evaluateFeasibility(
      [{ yarnTypeId: 'yt_1', requiredKg: 180 }],
      stockMap
    );

    expect(res.canStart).toBe(false);
    expect(res.isFeasible).toBe(false);
    expect(res.lines[0].requiredKg).toBe(180);
    expect(res.lines[0].availableKg).toBe(100);
    expect(res.lines[0].shortfallKg).toBe(80);
    expect(res.lines[0].isSufficient).toBe(false);
  });
});
