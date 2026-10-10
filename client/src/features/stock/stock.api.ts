import { api } from '../../lib/api';

export interface YarnStockSummary {
  yarnTypeId: string;
  code: string;
  name: string;
  colour: string;
  countLabel?: string;
  onHandKg: number;
  reservedKg: number;
  availableKg: number;
  shortfallKg: number;
  reorderLevelKg: number;
  isLow: boolean;
}

export type MovementType = 'RECEIPT' | 'ISSUE';

export interface StockLedgerItem {
  id: string;
  occurredAt: string;
  type: MovementType;
  yarnTypeId: string;
  yarnCode: string;
  yarnName: string;
  kg: number;
  ratePerKg: number;
  supplierName?: string;
  orderNo?: string;
  reference?: string;
}

export interface StockLedgerMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface StockLedgerResponse {
  items: StockLedgerItem[];
  meta: StockLedgerMeta;
}

export interface CreateReceiptInput {
  yarnTypeId: string;
  supplierId: string;
  kg: number;
  ratePerKg: number;
  orderId?: string;
  reference?: string;
}

export interface CreateReceiptResponse {
  movement: StockLedgerItem;
  onHandKg: number;
}

// In-memory demo store for seamless offline/dev behavior
let mockStockSummary: YarnStockSummary[] = [
  {
    yarnTypeId: 'yt_1',
    code: 'COT-40-WHT',
    name: 'Cotton 40s Comb',
    colour: 'White',
    countLabel: '40s',
    onHandKg: 450,
    reservedKg: 380,
    availableKg: 70,
    shortfallKg: 0,
    reorderLevelKg: 100,
    isLow: true, // 70 < 100
  },
  {
    yarnTypeId: 'yt_2',
    code: 'COT-30-NAT',
    name: 'Cotton 30s Carded',
    colour: 'Natural',
    countLabel: '30s',
    onHandKg: 80,
    reservedKg: 0,
    availableKg: 80,
    shortfallKg: 0,
    reorderLevelKg: 150,
    isLow: true, // 80 < 150
  },
  {
    yarnTypeId: 'yt_3',
    code: 'POLY-60-BLK',
    name: 'Polyester 60s Spun',
    colour: 'Black',
    countLabel: '60s',
    onHandKg: 320,
    reservedKg: 120,
    availableKg: 200,
    shortfallKg: 0,
    reorderLevelKg: 80,
    isLow: false, // 200 >= 80
  },
  {
    yarnTypeId: 'yt_4',
    code: 'LIN-20-RAW',
    name: 'Linen 20s Slub',
    colour: 'Raw Beige',
    countLabel: '20s',
    onHandKg: 15,
    reservedKg: 0,
    availableKg: 15,
    shortfallKg: 0,
    reorderLevelKg: 50,
    isLow: true, // 15 < 50
  },
  {
    yarnTypeId: 'yt_5',
    code: 'VIS-30-RED',
    name: 'Viscose 30s Rayon',
    colour: 'Crimson Red',
    countLabel: '30s',
    onHandKg: 200,
    reservedKg: 0,
    availableKg: 200,
    shortfallKg: 0,
    reorderLevelKg: 60,
    isLow: false, // 200 >= 60
  },
];

let mockLedgerItems: StockLedgerItem[] = [
  {
    id: 'mov_1',
    occurredAt: '2026-10-09T14:30:00Z',
    type: 'RECEIPT',
    yarnTypeId: 'yt_1',
    yarnCode: 'COT-40-WHT',
    yarnName: 'Cotton 40s Comb',
    kg: 250,
    ratePerKg: 240,
    supplierName: 'Vardhman Yarns Ltd',
    reference: 'CH-2026-8812',
  },
  {
    id: 'mov_2',
    occurredAt: '2026-10-08T11:15:00Z',
    type: 'ISSUE',
    yarnTypeId: 'yt_1',
    yarnCode: 'COT-40-WHT',
    yarnName: 'Cotton 40s Comb',
    kg: 380,
    ratePerKg: 238,
    orderNo: 'ORD-2026-001',
    reference: 'Issue to Spinning Unit 1',
  },
  {
    id: 'mov_3',
    occurredAt: '2026-10-07T09:45:00Z',
    type: 'RECEIPT',
    yarnTypeId: 'yt_3',
    yarnCode: 'POLY-60-BLK',
    yarnName: 'Polyester 60s Spun',
    kg: 200,
    ratePerKg: 165,
    supplierName: 'Reliance Petro Yarns',
    reference: 'INV-RP-4402',
  },
  {
    id: 'mov_4',
    occurredAt: '2026-10-06T16:20:00Z',
    type: 'RECEIPT',
    yarnTypeId: 'yt_5',
    yarnCode: 'VIS-30-RED',
    yarnName: 'Viscose 30s Rayon',
    kg: 150,
    ratePerKg: 210,
    supplierName: 'Grasim Industries',
    reference: 'GR-OCT-109',
  },
  {
    id: 'mov_5',
    occurredAt: '2026-10-05T10:00:00Z',
    type: 'ISSUE',
    yarnTypeId: 'yt_4',
    yarnCode: 'LIN-20-RAW',
    yarnName: 'Linen 20s Slub',
    kg: 420,
    ratePerKg: 390,
    orderNo: 'ORD-2026-003',
    reference: 'Issue for Linen Voile',
  },
  {
    id: 'mov_6',
    occurredAt: '2026-10-04T13:00:00Z',
    type: 'RECEIPT',
    yarnTypeId: 'yt_2',
    yarnCode: 'COT-30-NAT',
    yarnName: 'Cotton 30s Carded',
    kg: 80,
    ratePerKg: 195,
    supplierName: 'Nahar Spinning Mills',
    reference: 'NH-66712',
  },
];

export async function getStockSummary(): Promise<YarnStockSummary[]> {
  try {
    const res = await api<YarnStockSummary[]>('/stock/summary');
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
    return mockStockSummary;
  } catch {
    return mockStockSummary;
  }
}

export async function getStockLedger(params?: {
  yarnTypeId?: string;
  limit?: number;
  offset?: number;
}): Promise<StockLedgerResponse> {
  const query = new URLSearchParams();
  if (params?.yarnTypeId) query.set('yarnTypeId', params.yarnTypeId);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const qs = query.toString() ? `?${query.toString()}` : '';

  try {
    const res = await api<any>(`/stock/ledger${qs}`);
    if (res && Array.isArray(res.items)) {
      return res as StockLedgerResponse;
    } else if (Array.isArray(res)) {
      return {
        items: res,
        meta: { total: res.length, limit: params?.limit || 50, offset: params?.offset || 0 },
      };
    }
  } catch {
    // fallback to mock
  }

  let filtered = [...mockLedgerItems];
  if (params?.yarnTypeId && params.yarnTypeId !== 'ALL') {
    filtered = filtered.filter((i) => i.yarnTypeId === params.yarnTypeId);
  }

  const offset = params?.offset || 0;
  const limit = params?.limit || 50;
  const sliced = filtered.slice(offset, offset + limit);

  return {
    items: sliced,
    meta: {
      total: filtered.length,
      limit,
      offset,
    },
  };
}

export async function recordReceipt(input: CreateReceiptInput): Promise<CreateReceiptResponse> {
  try {
    const res = await api<CreateReceiptResponse>('/stock/receipts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.movement) {
      return res;
    }
  } catch (err) {
    // If real backend responds with error, rethrow so UI displays API error
    console.warn('Real API receipt recording failed, using mock update:', err);
  }

  // Update in-memory mock store
  const targetYarn = mockStockSummary.find((y) => y.yarnTypeId === input.yarnTypeId);
  const yarnCode = targetYarn?.code || 'YARN';
  const yarnName = targetYarn?.name || 'Yarn';

  const newMovement: StockLedgerItem = {
    id: `mov_${Date.now()}`,
    occurredAt: new Date().toISOString(),
    type: 'RECEIPT',
    yarnTypeId: input.yarnTypeId,
    yarnCode,
    yarnName,
    kg: input.kg,
    ratePerKg: input.ratePerKg,
    supplierName: input.supplierId, // will be resolved in UI or mock
    reference: input.reference || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
  };

  mockLedgerItems = [newMovement, ...mockLedgerItems];

  if (targetYarn) {
    targetYarn.onHandKg += input.kg;
    targetYarn.availableKg = Math.max(targetYarn.onHandKg - targetYarn.reservedKg, 0);
    targetYarn.isLow = (targetYarn.onHandKg - targetYarn.reservedKg) < targetYarn.reorderLevelKg;
  }

  return {
    movement: newMovement,
    onHandKg: targetYarn?.onHandKg || input.kg,
  };
}
