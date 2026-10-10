export interface OrderStatusContext {
  startedAt?: Date | string | null;
  hasJobs?: boolean;
  activeJobStage?: string | null;
  /** True when the order's latest DYEING job is COMPLETED (MVP 14.3). */
  dyeingDone?: boolean;
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

type Derived = {
  canonicalStatus: 'RECEIVED' | 'IN_PRODUCTION' | 'QUALITY_CHECK' | 'READY_TO_SHIP' | 'PARTIALLY_DISPATCHED' | 'COMPLETED';
  clientStatus: 'PENDING' | 'IN_PRODUCTION' | 'QC' | 'READY' | 'DISPATCHED' | 'COMPLETED';
};

const RECEIVED: Derived = { canonicalStatus: 'RECEIVED', clientStatus: 'PENDING' };
const IN_PRODUCTION: Derived = { canonicalStatus: 'IN_PRODUCTION', clientStatus: 'IN_PRODUCTION' };
const QUALITY_CHECK: Derived = { canonicalStatus: 'QUALITY_CHECK', clientStatus: 'QC' };
const READY_TO_SHIP: Derived = { canonicalStatus: 'READY_TO_SHIP', clientStatus: 'READY' };
const PARTIALLY_DISPATCHED: Derived = { canonicalStatus: 'PARTIALLY_DISPATCHED', clientStatus: 'DISPATCHED' };
const COMPLETED: Derived = { canonicalStatus: 'COMPLETED', clientStatus: 'COMPLETED' };

/**
 * Pure dynamic derivation of order status according to MVP Section 14.3.
 * Order status is strictly derived from operational progress (jobs, rolls, dispatches)
 * and is NEVER stored as a column in the database.
 *
 * Rejected rolls are scrap: they never block READY_TO_SHIP or full dispatch.
 * The spec's terminal DISPATCHED state is named COMPLETED here.
 */
export function deriveOrderStatus(ctx: OrderStatusContext): Derived {
  if (!ctx.startedAt && !ctx.hasJobs) return RECEIVED;

  const rolls = ctx.rolls || { total: 0, pendingQc: 0, rework: 0, passed: 0, rejected: 0, dispatched: 0 };
  const dyeingDone = !!ctx.dyeingDone;
  const live = rolls.total - rolls.rejected;

  if (rolls.dispatched > 0) {
    return dyeingDone && rolls.dispatched === live ? COMPLETED : PARTIALLY_DISPATCHED;
  }
  if (rolls.total === 0) return IN_PRODUCTION;
  if (dyeingDone && rolls.pendingQc + rolls.rework === 0 && rolls.passed > 0) return READY_TO_SHIP;
  return QUALITY_CHECK;
}
