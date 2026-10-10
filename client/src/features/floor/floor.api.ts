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
  statusNote?: string | null;
  assignedStaff?: { id: string; name: string; email: string } | null;
  statusUpdatedBy?: { id: string; name: string } | null;
  statusUpdatedAt?: string | null;
}

export interface FloorStaff {
  id: string;
  name: string;
  email: string;
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

/**
 * GET /api/v1/floor/board
 * Returns live floor machines grouped with stats
 */
export async function getBoard(): Promise<FloorBoardResponse> {
  return api<FloorBoardResponse>('/floor/board');
}

export async function listFloorStaff(): Promise<FloorStaff[]> {
  return api<FloorStaff[]>('/floor/staff');
}

export async function assignMachine(machineId: string, staffId: string | null): Promise<void> {
  await api(`/floor/machines/${machineId}/assignment`, {
    method: 'PATCH',
    body: JSON.stringify({ staffId }),
  });
}

export async function updateMachineStatus(
  machineId: string,
  status: MachineStatus,
  note?: string,
): Promise<void> {
  await api(`/floor/machines/${machineId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}

/**
 * POST /api/v1/floor/jobs
 * Assigns an order to an idle machine and sets it to RUNNING
 */
export async function startJob(input: StartJobInput): Promise<void> {
  await api('/floor/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * POST /api/v1/floor/jobs/:id/complete
 * Completes the active job and marks machine IDLE
 */
export async function completeJob(jobId: string): Promise<void> {
  await api(`/floor/jobs/${jobId}/complete`, { method: 'POST' });
}

/**
 * POST /api/v1/floor/machines/:id/breakdown
 * Marks machine under breakdown
 */
export async function markBreakdown(
  machineId: string,
  input?: MarkBreakdownInput
): Promise<void> {
  await api(`/floor/machines/${machineId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'BREAKDOWN', note: input?.reason }),
  });
}

/**
 * POST /api/v1/floor/machines/:id/restore
 * Restores machine from breakdown to IDLE (or RUNNING if had job)
 */
export async function restoreMachine(machineId: string): Promise<void> {
  const board = await getBoard();
  const machine = board.machines.find((item) => item.id === machineId);
  if (!machine) throw new Error('Machine not found');
  const status = machine.currentJob ? 'RUNNING' : 'IDLE';
  await updateMachineStatus(machineId, status);
}

/**
 * POST /api/v1/floor/logs
 * Logs metres produced per shift for a machine/job
 */
export async function logProduction(
  input: ProductionLogInput,
  userName = 'Supervisor'
): Promise<ProductionLogItem> {
  void userName;
  return api<ProductionLogItem>('/floor/logs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Returns list of recent production logs
 */
export async function getProductionLogs(limit = 20): Promise<ProductionLogItem[]> {
  return api<ProductionLogItem[]>(`/floor/logs?limit=${limit}`);
}
