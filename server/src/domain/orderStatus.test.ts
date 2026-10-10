import { describe, it, expect } from 'vitest';
import { deriveOrderStatus } from './orderStatus';

describe('deriveOrderStatus', () => {
  it('derives RECEIVED / PENDING when order has not started', () => {
    const res = deriveOrderStatus({});
    expect(res.canonicalStatus).toBe('RECEIVED');
    expect(res.clientStatus).toBe('PENDING');
  });

  it('derives IN_PRODUCTION when startedAt is set', () => {
    const res = deriveOrderStatus({ startedAt: new Date() });
    expect(res.canonicalStatus).toBe('IN_PRODUCTION');
    expect(res.clientStatus).toBe('IN_PRODUCTION');
  });

  it('derives IN_PRODUCTION when hasJobs is true', () => {
    const res = deriveOrderStatus({ hasJobs: true });
    expect(res.canonicalStatus).toBe('IN_PRODUCTION');
    expect(res.clientStatus).toBe('IN_PRODUCTION');
  });

  it('derives QUALITY_CHECK / QC when rolls are awaiting QC', () => {
    const res = deriveOrderStatus({
      hasJobs: true,
      rolls: {
        total: 2,
        pendingQc: 2,
        rework: 0,
        passed: 0,
        rejected: 0,
        dispatched: 0,
      },
    });
    expect(res.canonicalStatus).toBe('QUALITY_CHECK');
    expect(res.clientStatus).toBe('QC');
  });

  it('derives READY_TO_SHIP / READY when all rolls have passed inspection', () => {
    const res = deriveOrderStatus({
      hasJobs: true,
      rolls: {
        total: 2,
        pendingQc: 0,
        rework: 0,
        passed: 2,
        rejected: 0,
        dispatched: 0,
      },
    });
    expect(res.canonicalStatus).toBe('READY_TO_SHIP');
    expect(res.clientStatus).toBe('READY');
  });

  it('derives PARTIALLY_DISPATCHED / DISPATCHED when some rolls are dispatched', () => {
    const res = deriveOrderStatus({
      hasJobs: true,
      rolls: {
        total: 4,
        pendingQc: 0,
        rework: 0,
        passed: 2,
        rejected: 0,
        dispatched: 2,
      },
    });
    expect(res.canonicalStatus).toBe('PARTIALLY_DISPATCHED');
    expect(res.clientStatus).toBe('DISPATCHED');
  });

  it('derives COMPLETED when all rolls are dispatched', () => {
    const res = deriveOrderStatus({
      hasJobs: true,
      rolls: {
        total: 4,
        pendingQc: 0,
        rework: 0,
        passed: 0,
        rejected: 0,
        dispatched: 4,
      },
    });
    expect(res.canonicalStatus).toBe('COMPLETED');
    expect(res.clientStatus).toBe('COMPLETED');
  });
});
