export interface OrderStatusContext {
  startedAt?: Date | string | null;
  hasJobs?: boolean;
  activeJobStage?: string | null;
  rolls?: {
    total: number;
    pendingQc: number;
    rework: number;
    passed: number;
    rejected: number;
    dispatched: number;
  };
}

export type OrderStatus =
  | 'RECEIVED'
  | 'PENDING'
  | 'IN_PRODUCTION'
  | 'QUALITY_CHECK'
  | 'QC'
  | 'READY_TO_SHIP'
  | 'READY'
  | 'PARTIALLY_DISPATCHED'
  | 'COMPLETED'
  | 'DISPATCHED'
  | 'CANCELLED';

/**
 * Pure dynamic derivation of order status according to MVP Section 14.3.
 * Order status is strictly derived from operational progress (jobs, rolls, dispatches)
 * and is NEVER stored as a column in the database.
 */
export function deriveOrderStatus(ctx: OrderStatusContext): {
  canonicalStatus: 'RECEIVED' | 'IN_PRODUCTION' | 'QUALITY_CHECK' | 'READY_TO_SHIP' | 'PARTIALLY_DISPATCHED' | 'COMPLETED';
  clientStatus: 'PENDING' | 'IN_PRODUCTION' | 'QC' | 'READY' | 'DISPATCHED' | 'COMPLETED';
} {
  const rolls = ctx.rolls || {
    total: 0,
    pendingQc: 0,
    rework: 0,
    passed: 0,
    rejected: 0,
    dispatched: 0,
  };

  // 1. If rolls exist and some or all are dispatched
  if (rolls.total > 0 && rolls.dispatched > 0) {
    if (rolls.dispatched === rolls.total) {
      return { canonicalStatus: 'COMPLETED', clientStatus: 'COMPLETED' };
    }
    return { canonicalStatus: 'PARTIALLY_DISPATCHED', clientStatus: 'DISPATCHED' };
  }

  // 2. If rolls exist and all are passed (ready to dispatch)
  if (rolls.total > 0 && rolls.passed === rolls.total) {
    return { canonicalStatus: 'READY_TO_SHIP', clientStatus: 'READY' };
  }

  // 3. If rolls exist and some are in QC / rework
  if (rolls.total > 0 && (rolls.pendingQc > 0 || rolls.rework > 0)) {
    return { canonicalStatus: 'QUALITY_CHECK', clientStatus: 'QC' };
  }

  // 4. If production has started (jobs running or startedAt timestamp recorded)
  if (ctx.hasJobs || ctx.startedAt) {
    return { canonicalStatus: 'IN_PRODUCTION', clientStatus: 'IN_PRODUCTION' };
  }

  // 5. Default: order received, waiting to start
  return { canonicalStatus: 'RECEIVED', clientStatus: 'PENDING' };
}
