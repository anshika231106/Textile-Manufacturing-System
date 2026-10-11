import { api } from '../../lib/api';

export type OrderStatus =
  | 'PENDING'
  | 'IN_PRODUCTION'
  | 'QC'
  | 'READY'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'CANCELLED';

export type Stage = 'SPINNING' | 'WEAVING' | 'DYEING' | 'QC' | 'COMPLETED';

export interface YarnRequirement {
  yarnTypeId: string;
  yarnTypeName?: string;
  yarnTypeCode?: string;
  requiredKg: number;
  availableKg?: number;
  shortfallKg?: number;
  isSufficient?: boolean;
}

export interface FeasibilityItem {
  yarnTypeId: string;
  yarnTypeName: string;
  yarnTypeCode: string;
  requiredKg: number;
  availableKg: number;
  shortfallKg: number;
  isSufficient: boolean;
}

export interface FeasibilityResult {
  isFeasible: boolean;
  items: FeasibilityItem[];
}

export interface StageProgress {
  stage: 'SPINNING' | 'WEAVING' | 'DYEING';
  machineId?: string;
  machineName?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  producedMetres: number;
  targetMetres: number;
}

export interface RollItem {
  id: string;
  rollNumber: string;
  metres: number;
  qcStatus: 'PENDING' | 'PASS' | 'REWORK' | 'REJECT';
  defectType?: string;
  inspectedAt?: string;
}

export interface OrderRollSummary {
  totalRolls: number;
  passedRolls: number;
  inQcRolls: number;
  reworkRolls: number;
  rejectedRolls: number;
  rolls: RollItem[];
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  buyerPhone?: string;
  fabricType: string;
  colour: string;
  metres: number;
  ratePerMetre: number;
  totalAmount: number;
  status: OrderStatus;
  currentStage: Stage;
  deadline: string; // YYYY-MM-DD
  createdAt: string; // ISO
  trackingToken: string;
  yarnRequirements: YarnRequirement[];
  stageProgress: StageProgress[];
  rollSummary: OrderRollSummary;
  /** Roll counts by exact status (server-provided; `rollSummary.passedRolls` also includes dispatched rolls). */
  rolls?: OrderRollCounts;
}

export interface OrderRollCounts {
  total: number;
  pendingQc: number;
  rework: number;
  passed: number;
  rejected: number;
  dispatched: number;
  passedMetres: number;
  dispatchedMetres: number;
}

export interface PaginatedOrders {
  items: Order[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface CreateOrderInput {
  buyerId: string;
  fabricType: string;
  colour: string;
  metres: number;
  ratePerMetre: number;
  deadline: string;
  yarnRequirements: {
    yarnTypeId: string;
    requiredKg: number;
  }[];
}

// In-memory demo store for seamless offline/mock frontend development
const MOCK_STOCK_LEVELS: Record<string, number> = {
  'yt_1': 450, // COT-40-WHT
  'yt_2': 80,  // COT-30-NAT
  'yt_3': 320, // POLY-60-BLK
  'yt_4': 15,  // LIN-20-RAW
  'yt_5': 200, // VIS-30-RED
};

const YARN_INFO: Record<string, { code: string; name: string }> = {
  'yt_1': { code: 'COT-40-WHT', name: 'Cotton 40s Comb' },
  'yt_2': { code: 'COT-30-NAT', name: 'Cotton 30s Carded' },
  'yt_3': { code: 'POLY-60-BLK', name: 'Polyester 60s Spun' },
  'yt_4': { code: 'LIN-20-RAW', name: 'Linen 20s Slub' },
  'yt_5': { code: 'VIS-30-RED', name: 'Viscose 30s Rayon' },
};

const BUYER_NAMES: Record<string, string> = {
  'b_1': 'Nimesh Pathak Textiles',
  'b_2': 'Raymond Apparel Ltd',
  'b_3': 'Bombay Dyeing & Mfg',
  'b_4': 'Arvind Garments Hub',
};

let ordersStore: Order[] = [
  {
    id: 'ord_101',
    orderNumber: 'ORD-2026-001',
    buyerId: 'b_1',
    buyerName: 'Nimesh Pathak Textiles',
    buyerPhone: '9876543210',
    fabricType: 'Cotton Twill 2/1',
    colour: 'Bleached White',
    metres: 2500,
    ratePerMetre: 145,
    totalAmount: 362500,
    status: 'IN_PRODUCTION',
    currentStage: 'WEAVING',
    deadline: '2026-10-25',
    createdAt: '2026-10-01T09:30:00Z',
    trackingToken: 'tr_8f9a2b1c4e',
    yarnRequirements: [
      {
        yarnTypeId: 'yt_1',
        yarnTypeCode: 'COT-40-WHT',
        yarnTypeName: 'Cotton 40s Comb',
        requiredKg: 380,
        availableKg: 450,
        shortfallKg: 0,
        isSufficient: true,
      },
    ],
    stageProgress: [
      { stage: 'SPINNING', machineName: 'Spinning Unit 1', status: 'COMPLETED', producedMetres: 2500, targetMetres: 2500 },
      { stage: 'WEAVING', machineName: 'Loom Loom 3', status: 'IN_PROGRESS', producedMetres: 1400, targetMetres: 2500 },
      { stage: 'DYEING', machineName: 'Dyeing Vat 2', status: 'PENDING', producedMetres: 0, targetMetres: 2500 },
    ],
    rollSummary: {
      totalRolls: 3,
      passedRolls: 0,
      inQcRolls: 0,
      reworkRolls: 0,
      rejectedRolls: 0,
      rolls: [],
    },
  },
  {
    id: 'ord_102',
    orderNumber: 'ORD-2026-002',
    buyerId: 'b_2',
    buyerName: 'Raymond Apparel Ltd',
    buyerPhone: '9822012345',
    fabricType: 'Poly-Cotton Blend Suiting',
    colour: 'Navy Blue',
    metres: 1800,
    ratePerMetre: 220,
    totalAmount: 396000,
    status: 'PENDING',
    currentStage: 'SPINNING',
    deadline: '2026-10-30',
    createdAt: '2026-10-05T14:15:00Z',
    trackingToken: 'tr_1b4c7d9e2a',
    yarnRequirements: [
      {
        yarnTypeId: 'yt_1',
        yarnTypeCode: 'COT-40-WHT',
        yarnTypeName: 'Cotton 40s Comb',
        requiredKg: 150,
        availableKg: 450,
        shortfallKg: 0,
        isSufficient: true,
      },
      {
        yarnTypeId: 'yt_3',
        yarnTypeCode: 'POLY-60-BLK',
        yarnTypeName: 'Polyester 60s Spun',
        requiredKg: 120,
        availableKg: 320,
        shortfallKg: 0,
        isSufficient: true,
      },
    ],
    stageProgress: [
      { stage: 'SPINNING', machineName: 'Spinning Unit 2', status: 'PENDING', producedMetres: 0, targetMetres: 1800 },
      { stage: 'WEAVING', machineName: 'Loom Loom 1', status: 'PENDING', producedMetres: 0, targetMetres: 1800 },
      { stage: 'DYEING', machineName: 'Dyeing Vat 1', status: 'PENDING', producedMetres: 0, targetMetres: 1800 },
    ],
    rollSummary: {
      totalRolls: 0,
      passedRolls: 0,
      inQcRolls: 0,
      reworkRolls: 0,
      rejectedRolls: 0,
      rolls: [],
    },
  },
  {
    id: 'ord_103',
    orderNumber: 'ORD-2026-003',
    buyerId: 'b_3',
    buyerName: 'Bombay Dyeing & Mfg',
    buyerPhone: '9819055443',
    fabricType: 'Linen Slub Voile',
    colour: 'Raw Ivory',
    metres: 3000,
    ratePerMetre: 310,
    totalAmount: 930000,
    status: 'QC',
    currentStage: 'QC',
    deadline: '2026-10-18',
    createdAt: '2026-09-28T11:00:00Z',
    trackingToken: 'tr_9e8d7c6b5a',
    yarnRequirements: [
      {
        yarnTypeId: 'yt_4',
        yarnTypeCode: 'LIN-20-RAW',
        yarnTypeName: 'Linen 20s Slub',
        requiredKg: 420,
        availableKg: 15,
        shortfallKg: 0, // already issued prior to production
        isSufficient: true,
      },
    ],
    stageProgress: [
      { stage: 'SPINNING', machineName: 'Spinning Unit 1', status: 'COMPLETED', producedMetres: 3000, targetMetres: 3000 },
      { stage: 'WEAVING', machineName: 'Loom Loom 2', status: 'COMPLETED', producedMetres: 3000, targetMetres: 3000 },
      { stage: 'DYEING', machineName: 'Dyeing Vat 1', status: 'COMPLETED', producedMetres: 3000, targetMetres: 3000 },
    ],
    rollSummary: {
      totalRolls: 6,
      passedRolls: 4,
      inQcRolls: 2,
      reworkRolls: 0,
      rejectedRolls: 0,
      rolls: [
        { id: 'r_1', rollNumber: 'ORD-2026-003-R01', metres: 500, qcStatus: 'PASS', inspectedAt: '2026-10-08T10:00:00Z' },
        { id: 'r_2', rollNumber: 'ORD-2026-003-R02', metres: 500, qcStatus: 'PASS', inspectedAt: '2026-10-08T11:30:00Z' },
        { id: 'r_3', rollNumber: 'ORD-2026-003-R03', metres: 500, qcStatus: 'PASS', inspectedAt: '2026-10-09T09:15:00Z' },
        { id: 'r_4', rollNumber: 'ORD-2026-003-R04', metres: 500, qcStatus: 'PASS', inspectedAt: '2026-10-09T14:40:00Z' },
        { id: 'r_5', rollNumber: 'ORD-2026-003-R05', metres: 500, qcStatus: 'PENDING' },
        { id: 'r_6', rollNumber: 'ORD-2026-003-R06', metres: 500, qcStatus: 'PENDING' },
      ],
    },
  },
];

export async function listOrdersPage(filters: {
  status?: string;
  limit: number;
  offset: number;
}): Promise<PaginatedOrders> {
  try {
    const query = new URLSearchParams({
      limit: String(filters.limit),
      offset: String(filters.offset),
    });
    if (filters.status) query.set('status', filters.status);
    return await api<PaginatedOrders>(`/orders?${query.toString()}`);
  } catch {
    const filtered = filters.status
      ? ordersStore.filter((order) => order.status === filters.status)
      : [...ordersStore];
    return {
      items: filtered.slice(filters.offset, filters.offset + filters.limit),
      meta: { total: filtered.length, limit: filters.limit, offset: filters.offset },
    };
  }
}

export async function listOrders(filters?: { status?: string }): Promise<Order[]> {
  const result = await listOrdersPage({
    ...(filters?.status ? { status: filters.status } : {}),
    limit: 200,
    offset: 0,
  });
  return result.items;
}

export async function getOrder(id: string): Promise<Order> {
  try {
    return await api<Order>(`/orders/${id}`);
  } catch {
    const found = ordersStore.find((o) => o.id === id);
    if (!found) throw new Error('Order not found');
    return found;
  }
}

export async function checkFeasibility(
  yarnRequirements: { yarnTypeId: string; requiredKg: number }[]
): Promise<FeasibilityResult> {
  try {
    return await api<FeasibilityResult>('/orders/feasibility', {
      method: 'POST',
      body: JSON.stringify({ yarnRequirements }),
    });
  } catch {
    // Client-side simulation matching business rules
    const items: FeasibilityItem[] = yarnRequirements.map((req) => {
      const avail = MOCK_STOCK_LEVELS[req.yarnTypeId] ?? 100;
      const info = YARN_INFO[req.yarnTypeId] ?? { code: req.yarnTypeId, name: 'Yarn' };
      const shortfall = Math.max(0, req.requiredKg - avail);
      return {
        yarnTypeId: req.yarnTypeId,
        yarnTypeName: info.name,
        yarnTypeCode: info.code,
        requiredKg: req.requiredKg,
        availableKg: avail,
        shortfallKg: shortfall,
        isSufficient: shortfall === 0,
      };
    });

    return {
      isFeasible: items.every((i) => i.isSufficient),
      items,
    };
  }
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  try {
    return await api<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch {
    const orderNum = `ORD-2026-${String(ordersStore.length + 1).padStart(3, '0')}`;
    const buyerName = BUYER_NAMES[input.buyerId] ?? 'Buyer Partner';
    const trackingToken = `tr_${Math.random().toString(36).substring(2, 10)}`;

    const yarnRequirements: YarnRequirement[] = input.yarnRequirements.map((y) => {
      const avail = MOCK_STOCK_LEVELS[y.yarnTypeId] ?? 100;
      const info = YARN_INFO[y.yarnTypeId] ?? { code: y.yarnTypeId, name: 'Yarn' };
      const shortfall = Math.max(0, y.requiredKg - avail);
      return {
        yarnTypeId: y.yarnTypeId,
        yarnTypeName: info.name,
        yarnTypeCode: info.code,
        requiredKg: y.requiredKg,
        availableKg: avail,
        shortfallKg: shortfall,
        isSufficient: shortfall === 0,
      };
    });

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: orderNum,
      buyerId: input.buyerId,
      buyerName,
      fabricType: input.fabricType,
      colour: input.colour,
      metres: input.metres,
      ratePerMetre: input.ratePerMetre,
      totalAmount: input.metres * input.ratePerMetre,
      status: 'PENDING',
      currentStage: 'SPINNING',
      deadline: input.deadline,
      createdAt: new Date().toISOString(),
      trackingToken,
      yarnRequirements,
      stageProgress: [
        { stage: 'SPINNING', machineName: 'Spinning Unit 1', status: 'PENDING', producedMetres: 0, targetMetres: input.metres },
        { stage: 'WEAVING', machineName: 'Loom Loom 1', status: 'PENDING', producedMetres: 0, targetMetres: input.metres },
        { stage: 'DYEING', machineName: 'Dyeing Vat 1', status: 'PENDING', producedMetres: 0, targetMetres: input.metres },
      ],
      rollSummary: {
        totalRolls: 0,
        passedRolls: 0,
        inQcRolls: 0,
        reworkRolls: 0,
        rejectedRolls: 0,
        rolls: [],
      },
    };

    ordersStore = [newOrder, ...ordersStore];
    return newOrder;
  }
}

export async function startProduction(id: string): Promise<Order> {
  try {
    return await api<Order>(`/orders/${id}/start`, {
      method: 'POST',
    });
  } catch {
    const orderIndex = ordersStore.findIndex((o) => o.id === id);
    if (orderIndex === -1) throw new Error('Order not found');

    const order = ordersStore[orderIndex];
    if (order.status !== 'PENDING') {
      throw new Error('Order has already started production');
    }

    // Check shortfall
    const hasShortfall = order.yarnRequirements.some((y) => (y.shortfallKg ?? 0) > 0);
    if (hasShortfall) {
      throw new Error('INSUFFICIENT_YARN: Cannot start production with yarn shortfall.');
    }

    const updatedOrder: Order = {
      ...order,
      status: 'IN_PRODUCTION',
      currentStage: 'SPINNING',
      stageProgress: order.stageProgress.map((sp, idx) =>
        idx === 0 ? { ...sp, status: 'IN_PROGRESS' } : sp
      ),
    };

    ordersStore[orderIndex] = updatedOrder;
    return updatedOrder;
  }
}

// No mock fallback: a refused delete (e.g. ORDER_IN_USE) must surface to the user, not be faked.
export async function deleteOrder(id: string): Promise<void> {
  await api(`/orders/${id}`, { method: 'DELETE' });
}

export interface PublicSampleOrder {
  code: string;
  trackingToken: string;
  label: string;
  hint: string;
  status: OrderStatus;
  currentStage?: Stage;
  buyerName: string;
  fabricType: string;
  colour: string;
  metres: number;
}

export async function lookupOrderForPublic(query: string): Promise<Order | null> {
  const clean = query.trim();
  if (!clean) return null;
  try {
    return await api<Order>(`/public/track/${encodeURIComponent(clean)}`, { auth: false });
  } catch (err) {
    console.warn('Direct database order lookup error:', err);
    const upper = clean.toUpperCase();
    const found = ordersStore.find(
      (o) =>
        o.orderNumber.toUpperCase() === upper ||
        o.trackingToken.toUpperCase() === upper ||
        o.id.toUpperCase() === upper
    );
    return found ? { ...found } : null;
  }
}

export async function getPublicSampleOrders(): Promise<PublicSampleOrder[]> {
  try {
    return await api<PublicSampleOrder[]>('/public/samples', { auth: false });
  } catch {
    return [];
  }
}
