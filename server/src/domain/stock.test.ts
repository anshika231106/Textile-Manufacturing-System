import { describe, it, expect } from 'vitest';
import { computeYarnStock } from './stock';

describe('computeYarnStock', () => {
  it('computes stock when onHand exceeds reservations and is above reorder level', () => {
    const result = computeYarnStock({
      onHandKg: 500,
      reservedKg: 100,
      reorderLevelKg: 150,
    });

    expect(result.availableKg).toBe(400);
    expect(result.shortfallKg).toBe(0);
    expect(result.isLow).toBe(false); // 400 >= 150
  });

  it('flags isLow when available stock drops below reorder level', () => {
    const result = computeYarnStock({
      onHandKg: 200,
      reservedKg: 80,
      reorderLevelKg: 150,
    });

    expect(result.availableKg).toBe(120);
    expect(result.shortfallKg).toBe(0);
    expect(result.isLow).toBe(true); // 120 < 150
  });

  it('computes shortfall when reservations exceed onHand stock', () => {
    const result = computeYarnStock({
      onHandKg: 100,
      reservedKg: 150,
      reorderLevelKg: 50,
    });

    expect(result.availableKg).toBe(0);
    expect(result.shortfallKg).toBe(50);
    expect(result.isLow).toBe(true); // -50 < 50
  });
});
