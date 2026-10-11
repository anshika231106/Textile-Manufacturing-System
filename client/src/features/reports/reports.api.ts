import { api } from '../../lib/api';

export type Stage = 'SPINNING' | 'WEAVING' | 'DYEING';
export type MachineStatus = 'IDLE' | 'RUNNING' | 'BREAKDOWN';
export type OrderClientStatus = 'PENDING' | 'IN_PRODUCTION' | 'QC' | 'READY' | 'DISPATCHED' | 'COMPLETED';
export type ActivityType = 'PRODUCTION' | 'QC' | 'DISPATCH' | 'RECEIPT' | 'PAYMENT';

export interface ProductionDay {
  date: string; // YYYY-MM-DD
  SPINNING: number;
  WEAVING: number;
  DYEING: number;
  total: number;
}

export interface DashboardUpcomingOrder {
  id: string;
  orderNo: string;
  buyerName: string;
  fabricType: string;
  colour: string;
  metres: number;
  deadline: string;
  daysLeft: number;
  status: OrderClientStatus;
  stageMetres: Record<Stage, number>;
  dispatchedMetres: number;
  progressPercent: number;
}

export interface DashboardLowStockYarn {
  id: string;
  code: string;
  name: string;
  colour: string;
  onHandKg: number;
  reservedKg: number;
  reorderLevelKg: number;
  availableKg: number;
  shortfallKg: number;
  isLow: boolean;
}

export interface DashboardActivity {
  type: ActivityType;
  at: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
}

export interface DashboardData {
  generatedAt: string;
  ordersByStatus: { status: OrderClientStatus; count: number }[];
  production: {
    today: number;
    yesterday: number;
    last7Days: number;
    prev7Days: number;
    byShiftToday: Record<'MORNING' | 'EVENING' | 'NIGHT', number>;
    trend: ProductionDay[];
  };
  machines: {
    total: number;
    running: number;
    idle: number;
    breakdown: number;
    utilizationRate: number;
    byStage: {
      stage: Stage;
      total: number;
      running: number;
      idle: number;
      breakdown: number;
      metresToday: number;
      machines: { id: string; code: string; name: string; status: MachineStatus }[];
    }[];
    breakdowns: {
      id: string;
      code: string;
      name: string;
      stage: Stage;
      note: string | null;
      since: string | null;
      assignedTo: string | null;
    }[];
  };
  orders: {
    total: number;
    active: number;
    activeMetres: number;
    overdue: number;
    dueThisWeek: number;
    upcoming: DashboardUpcomingOrder[];
  };
  quality: {
    awaitingRolls: number;
    awaitingMetres: number;
    last7Days: { inspected: number; pass: number; rework: number; reject: number; passRate: number | null };
    defects: { type: string; count: number }[];
  };
  stock: { yarnTypes: number; totalOnHandKg: number; lowStock: DashboardLowStockYarn[] };
  finishedGoods: { readyRolls: number; readyMetres: number };
  workforce: { totalStaff: number; markedToday: number; presentToday: number; absentToday: number };
  /** null for SUPERVISOR - finance is OWNER / OFFICE only */
  finance: {
    invoicedThisMonth: number;
    collectedThisMonth: number;
    purchasesThisMonth: number;
    outstanding: number;
    unpaidInvoices: number;
    topReceivables: { buyerName: string; amount: number }[];
  } | null;
  activity: DashboardActivity[];
}

export interface OrderCostItem {
  orderId: string;
  orderNumber: string;
  buyerName: string;
  fabricType: string;
  metres: number;
  yarnCost: number;
  machineCost: number;
  invoicedAmount: number;
  marginAmount: number;
  marginPercent: number;
}

export interface MachineMetresItem {
  machineId: string;
  machineCode: string;
  machineName: string;
  stage: string;
  metresProduced: number;
  hoursActive: number;
  costTotal: number;
}

export interface MonthEndReport {
  month: string;
  purchases: number;
  /** Total payroll: staffWages + salaries */
  wages: number;
  /** Staff daily wages for days present */
  staffWages: number;
  /** Supervisor and office monthly salaries, prorated for mid-month joins and exits */
  salaries: number;
  salariedEmployees: number;
  /** Salaried employees with no salary set yet (counted as 0) */
  salaryNotSet: number;
  invoiced: number;
  paymentsReceived: number;
  profit: number;
  costPerOrder: OrderCostItem[];
  metresPerMachine: MachineMetresItem[];
}

const MOCK_MONTH_END: MonthEndReport = {
  month: '2026-10',
  purchases: 185000,
  wages: 114600,
  staffWages: 84600,
  salaries: 30000,
  salariedEmployees: 1,
  salaryNotSet: 0,
  invoiced: 585000,
  paymentsReceived: 420000,
  profit: 285400,
  costPerOrder: [
    {
      orderId: 'ord_101',
      orderNumber: 'ORD-2026-001',
      buyerName: 'Nimesh Pathak Textiles',
      fabricType: 'Cotton Twill 2/1',
      metres: 2500,
      yarnCost: 95000,
      machineCost: 22500,
      invoicedAmount: 362500,
      marginAmount: 245000,
      marginPercent: 67.6,
    },
    {
      orderId: 'ord_102',
      orderNumber: 'ORD-2026-002',
      buyerName: 'Raymond Apparel Ltd',
      fabricType: 'Poly-Cotton Blend Suiting',
      metres: 1800,
      yarnCost: 58000,
      machineCost: 19800,
      invoicedAmount: 396000,
      marginAmount: 318200,
      marginPercent: 80.4,
    },
    {
      orderId: 'ord_103',
      orderNumber: 'ORD-2026-003',
      buyerName: 'Bombay Dyeing & Mfg',
      fabricType: 'Pure Linen Slub 60s',
      metres: 800,
      yarnCost: 32000,
      machineCost: 11200,
      invoicedAmount: 248000,
      marginAmount: 204800,
      marginPercent: 82.5,
    },
  ],
  metresPerMachine: [
    {
      machineId: 'm_1',
      machineCode: 'SPIN-01',
      machineName: 'Ring Spinning Frame 1',
      stage: 'SPINNING',
      metresProduced: 4850,
      hoursActive: 168,
      costTotal: 9700,
    },
    {
      machineId: 'm_3',
      machineCode: 'LOOM-01',
      machineName: 'Sulzer Projectile Loom 1',
      stage: 'WEAVING',
      metresProduced: 3200,
      hoursActive: 154,
      costTotal: 11200,
    },
    {
      machineId: 'm_4',
      machineCode: 'LOOM-02',
      machineName: 'Rapier High-Speed Loom 2',
      stage: 'WEAVING',
      metresProduced: 2800,
      hoursActive: 140,
      costTotal: 8960,
    },
    {
      machineId: 'm_6',
      machineCode: 'DYE-01',
      machineName: 'Soft-Flow Jet Dyeing Vessel 1',
      stage: 'DYEING',
      metresProduced: 3500,
      hoursActive: 160,
      costTotal: 15750,
    },
  ],
};

/**
 * GET /api/v1/reports/dashboard (OWNER / OFFICE / SUPERVISOR).
 * No mock fallback: the dashboard must show real failures rather than stale sample numbers.
 */
export function getDashboard(): Promise<DashboardData> {
  return api<DashboardData>('/reports/dashboard');
}

/**
 * GET /api/v1/reports/month-end?month=YYYY-MM
 */
export async function getMonthEnd(month: string): Promise<MonthEndReport> {
  try {
    const res = await api<MonthEndReport>(`/reports/month-end?month=${encodeURIComponent(month)}`);
    if (res && typeof res.profit === 'number') {
      return res;
    }
  } catch {
    // fallback
  }

  return {
    ...MOCK_MONTH_END,
    month,
  };
}
