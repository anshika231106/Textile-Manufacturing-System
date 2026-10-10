import { describe, it, expect } from 'vitest';
import { deriveOrderStatus } from './orderStatus';

type RollStatus = 'PENDING_QC' | 'REWORK' | 'PASSED' | 'REJECTED' | 'DISPATCHED';

function rolls(...statuses: RollStatus[]) {
  const count = (s: RollStatus) => statuses.filter((x) => x === s).length;
  return {
    total: statuses.length,
    pendingQc: count('PENDING_QC'),
    rework: count('REWORK'),
    passed: count('PASSED'),
    rejected: count('REJECTED'),
    dispatched: count('DISPATCHED'),
  };
}

describe('deriveOrderStatus', () => {
  // MVP Section 14.3, T-03. The spec's terminal DISPATCHED state is COMPLETED here.
  const cases: [number, boolean, boolean, RollStatus[], string][] = [
    [1, false, false, [], 'RECEIVED'],
    [2, true, false, [], 'IN_PRODUCTION'],
    [3, true, false, ['PENDING_QC'], 'QUALITY_CHECK'],
    [4, true, true, ['PASSED', 'PASSED'], 'READY_TO_SHIP'],
    [5, true, true, ['PASSED', 'REWORK'], 'QUALITY_CHECK'],
    [6, true, true, ['PASSED', 'REJECTED'], 'READY_TO_SHIP'],
    [7, true, true, ['REJECTED'], 'QUALITY_CHECK'],
    [8, true, false, ['PASSED'], 'QUALITY_CHECK'],
    [9, true, true, ['DISPATCHED', 'PASSED'], 'PARTIALLY_DISPATCHED'],
    [10, true, true, ['DISPATCHED', 'DISPATCHED'], 'COMPLETED'],
    [11, true, true, ['DISPATCHED', 'REJECTED'], 'COMPLETED'],
    [12, true, false, ['DISPATCHED'], 'PARTIALLY_DISPATCHED'],
    [13, true, true, ['DISPATCHED', 'PENDING_QC'], 'PARTIALLY_DISPATCHED'],
    [14, true, true, [], 'IN_PRODUCTION'],
  ];

  it.each(cases)('case %i: started=%s dyeingDone=%s rolls=%j -> %s', (_n, started, dyeingDone, statuses, expected) => {
    const res = deriveOrderStatus({ startedAt: started ? new Date() : null, dyeingDone, rolls: rolls(...statuses) });
    expect(res.canonicalStatus).toBe(expected);
  });

  it('treats an order with stage jobs as started even without startedAt', () => {
    expect(deriveOrderStatus({ hasJobs: true }).canonicalStatus).toBe('IN_PRODUCTION');
  });

  it('maps canonical statuses to client statuses', () => {
    const started = new Date();
    expect(deriveOrderStatus({}).clientStatus).toBe('PENDING');
    expect(deriveOrderStatus({ startedAt: started }).clientStatus).toBe('IN_PRODUCTION');
    expect(deriveOrderStatus({ startedAt: started, rolls: rolls('PENDING_QC') }).clientStatus).toBe('QC');
    expect(deriveOrderStatus({ startedAt: started, dyeingDone: true, rolls: rolls('PASSED') }).clientStatus).toBe('READY');
    expect(deriveOrderStatus({ startedAt: started, dyeingDone: true, rolls: rolls('DISPATCHED', 'PASSED') }).clientStatus).toBe('DISPATCHED');
    expect(deriveOrderStatus({ startedAt: started, dyeingDone: true, rolls: rolls('DISPATCHED') }).clientStatus).toBe('COMPLETED');
  });
});
