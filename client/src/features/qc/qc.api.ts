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
  rollNo?: string;
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

// Initial mock rolls aligned with prisma seed.ts and sample orders
let mockRolls: QcRollItem[] = [
  {
    id: 'roll_1',
    rollNo: 'ROLL-0001',
    orderId: 'ord_101',
    orderNumber: 'ORD-2026-001',
    buyerName: 'Nimesh Pathak Textiles',
    fabricType: 'Cotton Twill 2/1',
    colour: 'Bleached White',
    metres: 100,
    weavingMachineId: 'm_3',
    weavingMachineName: 'Sulzer Projectile Loom 1',
    dyeingMachineId: 'm_6',
    dyeingMachineName: 'Soft-Flow Jet Dyeing Vessel 1',
    status: 'PASSED',
    lastResult: 'PASS',
    createdAt: '2026-10-10T08:00:00Z',
    inspectedAt: '2026-10-10T09:15:00Z',
    inspectorName: 'Suresh Patil',
    notes: 'Grade A roll, pristine weft count and colour evenness.',
  },
  {
    id: 'roll_2',
    rollNo: 'ROLL-0002',
    orderId: 'ord_101',
    orderNumber: 'ORD-2026-001',
    buyerName: 'Nimesh Pathak Textiles',
    fabricType: 'Cotton Twill 2/1',
    colour: 'Bleached White',
    metres: 100,
    weavingMachineId: 'm_3',
    weavingMachineName: 'Sulzer Projectile Loom 1',
    dyeingMachineId: 'm_6',
    dyeingMachineName: 'Soft-Flow Jet Dyeing Vessel 1',
    status: 'REWORK',
    lastResult: 'REWORK',
    defectType: 'UNEVEN_WEAVE',
    notes: 'Uneven tension on left selvedge between 40m - 55m. Needs mending.',
    createdAt: '2026-10-10T09:30:00Z',
    inspectedAt: '2026-10-10T10:45:00Z',
    inspectorName: 'Suresh Patil',
  },
  {
    id: 'roll_3',
    rollNo: 'ROLL-0003',
    orderId: 'ord_102',
    orderNumber: 'ORD-2026-002',
    buyerName: 'Raymond Apparel Ltd',
    fabricType: 'Poly-Cotton Blend Suiting',
    colour: 'Navy Blue',
    metres: 120,
    weavingMachineId: 'm_4',
    weavingMachineName: 'Rapier High-Speed Loom 2',
    dyeingMachineId: 'm_6',
    dyeingMachineName: 'Soft-Flow Jet Dyeing Vessel 1',
    status: 'PENDING_QC',
    createdAt: '2026-10-10T11:00:00Z',
  },
  {
    id: 'roll_4',
    rollNo: 'ROLL-0004',
    orderId: 'ord_103',
    orderNumber: 'ORD-2026-003',
    buyerName: 'Bombay Dyeing & Mfg',
    fabricType: 'Pure Linen Slub 60s',
    colour: 'Crimson Red',
    metres: 115,
    weavingMachineId: 'm_3',
    weavingMachineName: 'Sulzer Projectile Loom 1',
    dyeingMachineId: 'm_6',
    dyeingMachineName: 'Soft-Flow Jet Dyeing Vessel 1',
    status: 'PENDING_QC',
    createdAt: '2026-10-10T12:20:00Z',
  },
];

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
 * Returns rolls awaiting inspection or in rework, or full queue
 */
export async function getQcQueue(): Promise<QcRollItem[]> {
  try {
    const res = await api<QcRollItem[]>('/qc/queue');
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
  } catch {
    // fallback
  }

  return [...mockRolls];
}

/**
 * POST /api/v1/qc/rolls
 * Creates a new fabric roll from dyeing output
 */
export async function createRoll(input: CreateRollInput): Promise<QcRollItem> {
  try {
    const res = await api<QcRollItem>('/qc/rolls', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API createRoll error, executing locally:', err);
  }

  const nextNumber = mockRolls.length + 1;
  const rollNo = input.rollNo || `ROLL-${String(nextNumber).padStart(4, '0')}`;

  const orderNum = input.orderId === 'ord_101' ? 'ORD-2026-001'
    : input.orderId === 'ord_102' ? 'ORD-2026-002'
    : input.orderId === 'ord_103' ? 'ORD-2026-003'
    : 'ORD-2026-004';

  const buyer = input.orderId === 'ord_101' ? 'Nimesh Pathak Textiles'
    : input.orderId === 'ord_102' ? 'Raymond Apparel Ltd'
    : 'Bombay Dyeing & Mfg';

  const fabric = input.orderId === 'ord_101' ? 'Cotton Twill 2/1'
    : input.orderId === 'ord_102' ? 'Poly-Cotton Blend Suiting'
    : 'Pure Linen Slub 60s';

  const colour = input.orderId === 'ord_101' ? 'Bleached White'
    : input.orderId === 'ord_102' ? 'Navy Blue'
    : 'Crimson Red';

  const newRoll: QcRollItem = {
    id: `roll_${Date.now()}`,
    rollNo,
    orderId: input.orderId,
    orderNumber: orderNum,
    buyerName: buyer,
    fabricType: fabric,
    colour,
    metres: Number(input.metres),
    weavingMachineId: input.weavingMachineId,
    weavingMachineName: input.weavingMachineId === 'm_3' ? 'Sulzer Projectile Loom 1' : 'Rapier High-Speed Loom 2',
    dyeingMachineId: input.dyeingMachineId,
    dyeingMachineName: 'Soft-Flow Jet Dyeing Vessel 1',
    status: 'PENDING_QC',
    createdAt: new Date().toISOString(),
  };

  mockRolls = [newRoll, ...mockRolls];
  return newRoll;
}

/**
 * POST /api/v1/qc/rolls/:id/result
 * Records inspection verdict (PASS / REWORK / REJECT) with defect reasons
 */
export async function recordResult(
  rollId: string,
  input: RecordResultInput
): Promise<QcRollItem> {
  try {
    const res = await api<QcRollItem>(`/qc/rolls/${rollId}/result`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API recordResult error, executing locally:', err);
  }

  const idx = mockRolls.findIndex((r) => r.id === rollId);
  if (idx === -1) throw new Error('Roll not found');

  const current = mockRolls[idx];

  let nextStatus: RollStatus;
  if (input.result === 'PASS') {
    nextStatus = 'PASSED';
  } else if (input.result === 'REWORK') {
    nextStatus = 'REWORK';
  } else {
    nextStatus = 'REJECTED';
  }

  const updated: QcRollItem = {
    ...current,
    status: nextStatus,
    lastResult: input.result,
    defectType: input.result === 'PASS' ? undefined : input.defectType,
    notes: input.notes,
    inspectedAt: new Date().toISOString(),
    inspectorName: input.inspectorName || 'Suresh Patil (Supervisor)',
  };

  mockRolls[idx] = updated;
  return updated;
}
