import { api } from '../../lib/api';

export interface RollTraceData {
  roll: {
    id: string;
    rollNo: string;
    metres: number;
    status: 'PENDING_QC' | 'PASSED' | 'REWORK' | 'REJECTED' | 'DISPATCHED';
    createdAt: string;
    weavingMachine: { id: string; code: string; name: string; stage: string };
    dyeingMachine: { id: string; code: string; name: string; stage: string };
    createdBy: { id: string; name: string; role: string };
  };
  order: {
    id: string;
    orderNo: string;
    buyer: { id: string; name: string; contactName?: string; phone?: string };
    fabricType: string;
    colour: string;
    metres: number;
    ratePerMetre: number;
    deadline: string;
    startedAt: string | null;
    trackingToken: string;
    requirements: {
      yarnTypeId: string;
      yarnCode: string;
      yarnName: string;
      colour: string;
      kgPerMetre: number;
    }[];
  };
  yarnIssued: {
    id: string;
    yarnTypeId: string;
    yarnCode: string;
    yarnName: string;
    colour: string;
    kg: number;
    ratePerKg: number;
    totalCost: number;
    reference?: string;
    occurredAt: string;
    issuedByName: string;
  }[];
  stageJobs: {
    id: string;
    stage: 'SPINNING' | 'WEAVING' | 'DYEING';
    machineId: string;
    machineCode: string;
    machineName: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    isWeavingMachineForThisRoll: boolean;
    isDyeingMachineForThisRoll: boolean;
  }[];
  productionLogs: {
    id: string;
    stageJobId: string;
    stage: string;
    shift: 'MORNING' | 'EVENING' | 'NIGHT';
    metres: number;
    machineId: string;
    machineCode: string;
    machineName: string;
    loggedAt: string;
    operatorName: string;
    notes?: string;
  }[];
  qcHistory: {
    id: string;
    result: 'PASS' | 'REWORK' | 'REJECT';
    defectType?: 'HOLE' | 'COLOUR_MISMATCH' | 'UNEVEN_WEAVE' | 'OTHER';
    notes?: string;
    checkedAt: string;
    inspector: { id: string; name: string };
  }[];
  dispatch: {
    id: string;
    dispatchNo: string;
    vehicleNo?: string;
    dispatchedAt: string;
    dispatchedByName: string;
    invoice: {
      id: string;
      invoiceNo: string;
      amount: number;
      paidAmount: number;
      status: string;
      issuedAt: string;
    } | null;
  } | null;
}

export async function getRollTrace(idOrCode: string): Promise<RollTraceData> {
  const clean = idOrCode.trim();
  return api<RollTraceData>(`/rolls/${encodeURIComponent(clean)}/trace`);
}
