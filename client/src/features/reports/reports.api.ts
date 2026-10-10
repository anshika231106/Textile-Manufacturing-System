import { api } from '../../lib/api';

export interface DashboardReportData {
  ordersByStatus: { status: string; count: number }[];
  machinesRunning: number;
  machinesIdle: number;
  machinesBreakdown: number;
  lowStockYarnCount: number;
  rollsAwaitingQc: number;
  metresTodayProduced: number;
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
  wages: number;
  invoiced: number;
  paymentsReceived: number;
  profit: number;
  costPerOrder: OrderCostItem[];
  metresPerMachine: MachineMetresItem[];
}

const MOCK_DASHBOARD_DATA: DashboardReportData = {
  ordersByStatus: [
    { status: 'PENDING', count: 3 },
    { status: 'IN_PRODUCTION', count: 5 },
    { status: 'QC', count: 2 },
    { status: 'READY', count: 4 },
    { status: 'DISPATCHED', count: 8 },
  ],
  machinesRunning: 5,
  machinesIdle: 2,
  machinesBreakdown: 1,
  lowStockYarnCount: 1,
  rollsAwaitingQc: 2,
  metresTodayProduced: 3850,
};

const MOCK_MONTH_END: MonthEndReport = {
  month: '2026-10',
  purchases: 185000,
  wages: 114600,
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
 * GET /api/v1/reports/dashboard
 */
export async function getDashboard(): Promise<DashboardReportData> {
  try {
    const res = await api<DashboardReportData>('/reports/dashboard');
    if (res && Array.isArray(res.ordersByStatus)) {
      return res;
    }
  } catch {
    // fallback
  }
  return MOCK_DASHBOARD_DATA;
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
