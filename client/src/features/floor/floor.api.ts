import { api } from '../../lib/api';

export type Stage = 'SPINNING' | 'WEAVING' | 'DYEING';
export type MachineStatus = 'IDLE' | 'RUNNING' | 'BREAKDOWN';
export type Shift = 'MORNING' | 'EVENING' | 'NIGHT';

export interface CurrentJob {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerName: string;
  fabricType: string;
  colour: string;
  stage: Stage;
  targetMetres: number;
  producedMetres: number;
  startedAt: string;
  shift?: Shift;
}

export interface FloorMachine {
  id: string;
  code: string;
  name: string;
  stage: Stage;
  status: MachineStatus;
  ratePerMetre: number;
  currentJob?: CurrentJob | null;
  metresToday: number;
  breakdownReason?: string;
  breakdownReportedAt?: string;
}

export interface BoardStats {
  totalMachines: number;
  running: number;
  idle: number;
  breakdown: number;
  totalMetresToday: number;
  utilizationRate: number;
}

export interface FloorBoardResponse {
  machines: FloorMachine[];
  stats: BoardStats;
}

export interface StartJobInput {
  machineId: string;
  orderId: string;
  stage: Stage;
  shift?: Shift;
}

export interface MarkBreakdownInput {
  reason?: string;
}

export interface ProductionLogInput {
  stageJobId?: string;
  machineId: string;
  orderId: string;
  stage: Stage;
  shift: Shift;
  metres: number;
  notes?: string;
}

export interface ProductionLogItem {
  id: string;
  stageJobId?: string;
  orderId: string;
  orderNumber: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  stage: Stage;
  shift: Shift;
  metres: number;
  loggedAt: string;
  createdByName: string;
  notes?: string;
}

// In-memory initial data aligned with seed and master data
let mockFloorMachines: FloorMachine[] = [
  {
    id: 'm_1',
    code: 'SPIN-01',
    name: 'Ring Spinning Frame 1',
    stage: 'SPINNING',
    status: 'RUNNING',
    ratePerMetre: 2.0,
    metresToday: 480,
    currentJob: {
      id: 'job_spin_1',
      orderId: 'ord_102',
      orderNumber: 'ORD-2026-002',
      buyerName: 'Raymond Apparel Ltd',
      fabricType: 'Poly-Cotton Blend Suiting',
      colour: 'Navy Blue',
      stage: 'SPINNING',
      targetMetres: 1800,
      producedMetres: 480,
      startedAt: '2026-10-10T06:30:00Z',
      shift: 'MORNING',
    },
  },
  {
    id: 'm_2',
    code: 'SPIN-02',
    name: 'Rotor Open-End Frame 2',
    stage: 'SPINNING',
    status: 'IDLE',
    ratePerMetre: 2.5,
    metresToday: 0,
    currentJob: null,
  },
  {
    id: 'm_3',
    code: 'LOOM-01',
    name: 'Sulzer Projectile Loom 1',
    stage: 'WEAVING',
    status: 'RUNNING',
    ratePerMetre: 3.5,
    metresToday: 650,
    currentJob: {
      id: 'job_weave_1',
      orderId: 'ord_101',
      orderNumber: 'ORD-2026-001',
      buyerName: 'Nimesh Pathak Textiles',
      fabricType: 'Cotton Twill 2/1',
      colour: 'Bleached White',
      stage: 'WEAVING',
      targetMetres: 2500,
      producedMetres: 1400,
      startedAt: '2026-10-09T08:00:00Z',
      shift: 'MORNING',
    },
  },
  {
    id: 'm_4',
    code: 'LOOM-02',
    name: 'Rapier High-Speed Loom 2',
    stage: 'WEAVING',
    status: 'IDLE',
    ratePerMetre: 3.2,
    metresToday: 120,
    currentJob: null,
  },
  {
    id: 'm_5',
    code: 'LOOM-03',
    name: 'Air-Jet High Loom 3',
    stage: 'WEAVING',
    status: 'BREAKDOWN',
    ratePerMetre: 2.8,
    metresToday: 90,
    breakdownReason: 'Warp yarn tension sensor failure & heald frame misalignment',
    breakdownReportedAt: '2026-10-10T07:15:00Z',
    currentJob: null,
  },
  {
    id: 'm_6',
    code: 'DYE-01',
    name: 'Soft-Flow Jet Dyeing Vessel 1',
    stage: 'DYEING',
    status: 'RUNNING',
    ratePerMetre: 4.5,
    metresToday: 500,
    currentJob: {
      id: 'job_dye_1',
      orderId: 'ord_103',
      orderNumber: 'ORD-2026-003',
      buyerName: 'Bombay Dyeing & Mfg',
      fabricType: 'Pure Linen Slub 60s',
      colour: 'Crimson Red',
      stage: 'DYEING',
      targetMetres: 800,
      producedMetres: 500,
      startedAt: '2026-10-10T09:00:00Z',
      shift: 'MORNING',
    },
  },
  {
    id: 'm_7',
    code: 'DYE-02',
    name: 'Jigger Dyeing Machine 2',
    stage: 'DYEING',
    status: 'IDLE',
    ratePerMetre: 3.8,
    metresToday: 0,
    currentJob: null,
  },
];

let mockProductionLogs: ProductionLogItem[] = [
  {
    id: 'log_1',
    stageJobId: 'job_weave_1',
    orderId: 'ord_101',
    orderNumber: 'ORD-2026-001',
    machineId: 'm_3',
    machineCode: 'LOOM-01',
    machineName: 'Sulzer Projectile Loom 1',
    stage: 'WEAVING',
    shift: 'MORNING',
    metres: 350,
    loggedAt: '2026-10-10T11:30:00Z',
    createdByName: 'Ganesh Kumar',
    notes: 'Smooth weaving batch, warp tension stable',
  },
  {
    id: 'log_2',
    stageJobId: 'job_spin_1',
    orderId: 'ord_102',
    orderNumber: 'ORD-2026-002',
    machineId: 'm_1',
    machineCode: 'SPIN-01',
    machineName: 'Ring Spinning Frame 1',
    stage: 'SPINNING',
    shift: 'MORNING',
    metres: 480,
    loggedAt: '2026-10-10T12:00:00Z',
    createdByName: 'Dinesh Rao',
    notes: '40s count blend running at standard speed',
  },
  {
    id: 'log_3',
    stageJobId: 'job_dye_1',
    orderId: 'ord_103',
    orderNumber: 'ORD-2026-003',
    machineId: 'm_6',
    machineCode: 'DYE-01',
    machineName: 'Soft-Flow Jet Dyeing Vessel 1',
    stage: 'DYEING',
    shift: 'MORNING',
    metres: 500,
    loggedAt: '2026-10-10T13:15:00Z',
    createdByName: 'Suresh Patil',
    notes: 'Even shade penetration achieved for crimson batch',
  },
];

function calculateStats(machines: FloorMachine[]): BoardStats {
  const total = machines.length;
  const running = machines.filter((m) => m.status === 'RUNNING').length;
  const idle = machines.filter((m) => m.status === 'IDLE').length;
  const breakdown = machines.filter((m) => m.status === 'BREAKDOWN').length;
  const totalMetresToday = machines.reduce((acc, m) => acc + (m.metresToday || 0), 0);
  const utilizationRate = total > 0 ? Math.round((running / total) * 100) : 0;

  return {
    totalMachines: total,
    running,
    idle,
    breakdown,
    totalMetresToday,
    utilizationRate,
  };
}

/**
 * GET /api/v1/floor/board
 * Returns live floor machines grouped with stats
 */
export async function getBoard(): Promise<FloorBoardResponse> {
  try {
    const res = await api<FloorBoardResponse>('/floor/board');
    if (res && Array.isArray(res.machines)) {
      return res;
    }
  } catch {
    // fallback to mock store
  }

  return {
    machines: [...mockFloorMachines],
    stats: calculateStats(mockFloorMachines),
  };
}

/**
 * POST /api/v1/floor/jobs
 * Assigns an order to an idle machine and sets it to RUNNING
 */
export async function startJob(input: StartJobInput): Promise<FloorMachine> {
  try {
    const res = await api<FloorMachine>('/floor/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API startJob error, executing locally:', err);
  }

  const idx = mockFloorMachines.findIndex((m) => m.id === input.machineId);
  if (idx === -1) throw new Error('Machine not found');

  const machine = mockFloorMachines[idx];
  if (machine.status === 'BREAKDOWN') {
    throw new Error('Cannot start job on machine under breakdown.');
  }

  // Find order details or use placeholder
  const orderNumber = input.orderId.startsWith('ord_')
    ? input.orderId === 'ord_101' ? 'ORD-2026-001' : input.orderId === 'ord_102' ? 'ORD-2026-002' : 'ORD-2026-003'
    : input.orderId;

  const newJob: CurrentJob = {
    id: `job_${Date.now()}`,
    orderId: input.orderId,
    orderNumber,
    buyerName: 'Active Client Order',
    fabricType: `${machine.stage} Batch Spec`,
    colour: 'Standard',
    stage: input.stage || machine.stage,
    targetMetres: 1500,
    producedMetres: 0,
    startedAt: new Date().toISOString(),
    shift: input.shift || 'MORNING',
  };

  const updated: FloorMachine = {
    ...machine,
    status: 'RUNNING',
    currentJob: newJob,
    breakdownReason: undefined,
    breakdownReportedAt: undefined,
  };

  mockFloorMachines[idx] = updated;
  return updated;
}

/**
 * POST /api/v1/floor/jobs/:id/complete
 * Completes the active job and marks machine IDLE
 */
export async function completeJob(jobId: string): Promise<FloorMachine> {
  try {
    const res = await api<FloorMachine>(`/floor/jobs/${jobId}/complete`, {
      method: 'POST',
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API completeJob error, executing locally:', err);
  }

  const idx = mockFloorMachines.findIndex(
    (m) => m.currentJob?.id === jobId || m.id === jobId
  );
  if (idx === -1) throw new Error('Active job / machine not found');

  const machine = mockFloorMachines[idx];
  const updated: FloorMachine = {
    ...machine,
    status: 'IDLE',
    currentJob: null,
  };

  mockFloorMachines[idx] = updated;
  return updated;
}

/**
 * POST /api/v1/floor/machines/:id/breakdown
 * Marks machine under breakdown
 */
export async function markBreakdown(
  machineId: string,
  input?: MarkBreakdownInput
): Promise<FloorMachine> {
  try {
    const res = await api<FloorMachine>(`/floor/machines/${machineId}/breakdown`, {
      method: 'POST',
      body: JSON.stringify(input || {}),
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API markBreakdown error, executing locally:', err);
  }

  const idx = mockFloorMachines.findIndex((m) => m.id === machineId);
  if (idx === -1) throw new Error('Machine not found');

  const machine = mockFloorMachines[idx];
  const updated: FloorMachine = {
    ...machine,
    status: 'BREAKDOWN',
    breakdownReason: input?.reason || 'Reported breakdown by supervisor',
    breakdownReportedAt: new Date().toISOString(),
    // job remains paused or suspended
  };

  mockFloorMachines[idx] = updated;
  return updated;
}

/**
 * POST /api/v1/floor/machines/:id/restore
 * Restores machine from breakdown to IDLE (or RUNNING if had job)
 */
export async function restoreMachine(machineId: string): Promise<FloorMachine> {
  try {
    const res = await api<FloorMachine>(`/floor/machines/${machineId}/restore`, {
      method: 'POST',
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API restoreMachine error, executing locally:', err);
  }

  const idx = mockFloorMachines.findIndex((m) => m.id === machineId);
  if (idx === -1) throw new Error('Machine not found');

  const machine = mockFloorMachines[idx];
  const updated: FloorMachine = {
    ...machine,
    status: machine.currentJob ? 'RUNNING' : 'IDLE',
    breakdownReason: undefined,
    breakdownReportedAt: undefined,
  };

  mockFloorMachines[idx] = updated;
  return updated;
}

/**
 * POST /api/v1/floor/logs
 * Logs metres produced per shift for a machine/job
 */
export async function logProduction(
  input: ProductionLogInput,
  userName = 'Supervisor'
): Promise<ProductionLogItem> {
  try {
    const res = await api<ProductionLogItem>('/floor/logs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API logProduction error, executing locally:', err);
  }

  const machine = mockFloorMachines.find((m) => m.id === input.machineId);
  const newLog: ProductionLogItem = {
    id: `log_${Date.now()}`,
    stageJobId: input.stageJobId || machine?.currentJob?.id,
    orderId: input.orderId || machine?.currentJob?.orderId || 'ord_101',
    orderNumber: machine?.currentJob?.orderNumber || 'ORD-2026-001',
    machineId: input.machineId,
    machineCode: machine?.code || 'MACH',
    machineName: machine?.name || 'Machine',
    stage: input.stage || machine?.stage || 'WEAVING',
    shift: input.shift,
    metres: Number(input.metres),
    loggedAt: new Date().toISOString(),
    createdByName: userName,
    notes: input.notes,
  };

  mockProductionLogs = [newLog, ...mockProductionLogs];

  // Update machine's metresToday and currentJob producedMetres
  if (machine) {
    machine.metresToday = (machine.metresToday || 0) + Number(input.metres);
    if (machine.currentJob) {
      machine.currentJob.producedMetres += Number(input.metres);
    }
  }

  return newLog;
}

/**
 * Returns list of recent production logs
 */
export async function getProductionLogs(limit = 20): Promise<ProductionLogItem[]> {
  try {
    const res = await api<ProductionLogItem[]>(`/floor/logs?limit=${limit}`);
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
  } catch {
    // fallback
  }

  return [...mockProductionLogs].slice(0, limit);
}
