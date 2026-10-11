import { api } from '../../lib/api';

export type RollStatus =
  | 'PENDING_QC'
  | 'PASSED'
  | 'REWORK'
  | 'REJECTED'
  | 'DISPATCHED';

export type QcResult = 'PASS' | 'REWORK' | 'REJECT';

export type DefectType =
  | 'HOLE'
  | 'COLOUR_MISMATCH'
  | 'UNEVEN_WEAVE'
  | 'OTHER';

export interface QcRollItem {
  id: string;
  rollNo: string;
  orderId: string;
  orderNumber: string;
  buyerName: string;
  fabricType: string;
  colour: string;
  metres: number;
  weavingMachineId: string;
  weavingMachineName: string;
  dyeingMachineId: string;
  dyeingMachineName: string;
  status: RollStatus;
  lastResult?: QcResult;
  defectType?: DefectType;
  notes?: string;
  createdAt: string;
  inspectedAt?: string;
  inspectorName?: string;
}

export interface CreateRollInput {
  orderId: string;
  metres: number;
  weavingMachineId: string;
  dyeingMachineId: string;
}

export interface RollableMachine {
  id: string;
  code: string;
  name: string;
}

export interface RollableOrder {
  id: string;
  orderNumber: string;
  buyerName: string;
  fabricType: string;
  colour: string;
  metres: number;
  dyeingOutput: number;
  alreadyRolled: number;
  remainingMetres: number;
  weavingMachines: RollableMachine[];
  dyeingMachines: RollableMachine[];
}

export interface RecordResultInput {
  result: QcResult;
  defectType?: DefectType;
  notes?: string;
  inspectorName?: string;
}

export interface QcStats {
  totalRolls: number;
  pendingQc: number;
  passed: number;
  rework: number;
  rejected: number;
  passRate: number;
}

export function calculateQcStats(rolls: QcRollItem[]): QcStats {
  const totalRolls = rolls.length;
  const pendingQc = rolls.filter((r) => r.status === 'PENDING_QC').length;
  const passed = rolls.filter((r) => r.status === 'PASSED').length;
  const rework = rolls.filter((r) => r.status === 'REWORK').length;
  const rejected = rolls.filter((r) => r.status === 'REJECTED').length;
  const inspected = passed + rework + rejected;
  const passRate = inspected > 0 ? Math.round((passed / inspected) * 100) : 100;

  return {
    totalRolls,
    pendingQc,
    passed,
    rework,
    rejected,
    passRate,
  };
}

/**
 * GET /api/v1/qc/queue
 * Returns every roll, newest first; the page filters by status.
 */
export async function getQcQueue(): Promise<QcRollItem[]> {
  return api<QcRollItem[]>('/qc/queue');
}

/**
 * GET /api/v1/qc/roll-orders
 * Orders that have completed spinning, weaving and dyeing and still have dyed metres left to roll.
 */
export async function listRollableOrders(): Promise<RollableOrder[]> {
  return api<RollableOrder[]>('/qc/roll-orders');
}

/**
 * POST /api/v1/qc/rolls
 * Creates a new fabric roll from dyeing output. Errors (e.g. EXCEEDS_STAGE_OUTPUT) propagate to the caller.
 */
export async function createRoll(input: CreateRollInput): Promise<QcRollItem> {
  return api<QcRollItem>('/qc/rolls', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * POST /api/v1/qc/rolls/:id/result
 * Records inspection verdict (PASS / REWORK / REJECT) with defect reasons
 */
export async function recordResult(
  rollId: string,
  input: RecordResultInput
): Promise<QcRollItem> {
  return api<QcRollItem>(`/qc/rolls/${rollId}/result`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
