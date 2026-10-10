import { api } from '../../lib/api';

export interface FinishedGoodItem {
  id: string; // rollId
  rollNo: string;
  orderId: string;
  orderNumber: string;
  buyerName: string;
  fabricType: string;
  colour: string;
  metres: number;
  ratePerMetre: number;
  status: 'PASSED' | 'PENDING_QC' | 'REWORK' | 'REJECTED' | 'DISPATCHED';
}

export type RollValidationErrorCode =
  | 'UNKNOWN_ROLL'
  | 'NOT_PASSED'
  | 'WRONG_ORDER'
  | 'ALREADY_DISPATCHED';

export interface ValidateRollResult {
  valid: boolean;
  errorCode?: RollValidationErrorCode;
  errorMessage?: string;
  roll?: FinishedGoodItem;
}

export interface ConfirmDispatchInput {
  orderId: string;
  rollIds: string[];
  vehicleNo?: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  paidOn: string;
  method: string;
  reference?: string;
  createdByName?: string;
}

export interface InvoiceItemRoll {
  rollId: string;
  rollNo: string;
  metres: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  dispatchId: string;
  dispatchNo: string;
  orderId: string;
  orderNumber: string;
  buyerName: string;
  fabricType: string;
  colour: string;
  totalMetres: number;
  ratePerMetre: number;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  issuedAt: string;
  vehicleNo?: string;
  rolls: InvoiceItemRoll[];
  payments: InvoicePayment[];
}

export interface ConfirmDispatchResponse {
  dispatch: {
    id: string;
    dispatchNo: string;
    orderId: string;
    orderNumber: string;
    vehicleNo?: string;
    dispatchedAt: string;
    totalMetres: number;
    rollCount: number;
  };
  invoice: Invoice;
}

// Initial mock inventory of finished rolls ready or processed
let mockFinishedGoods: FinishedGoodItem[] = [
  {
    id: 'roll_1',
    rollNo: 'ROLL-0001',
    orderId: 'ord_101',
    orderNumber: 'ORD-2026-001',
    buyerName: 'Nimesh Pathak Textiles',
    fabricType: 'Cotton Twill 2/1',
    colour: 'Bleached White',
    metres: 100,
    ratePerMetre: 145,
    status: 'PASSED',
  },
  {
    id: 'roll_101',
    rollNo: 'ROLL-0005',
    orderId: 'ord_101',
    orderNumber: 'ORD-2026-001',
    buyerName: 'Nimesh Pathak Textiles',
    fabricType: 'Cotton Twill 2/1',
    colour: 'Bleached White',
    metres: 120,
    ratePerMetre: 145,
    status: 'PASSED',
  },
  {
    id: 'roll_102',
    rollNo: 'ROLL-0006',
    orderId: 'ord_101',
    orderNumber: 'ORD-2026-001',
    buyerName: 'Nimesh Pathak Textiles',
    fabricType: 'Cotton Twill 2/1',
    colour: 'Bleached White',
    metres: 110,
    ratePerMetre: 145,
    status: 'PASSED',
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
    ratePerMetre: 145,
    status: 'REWORK',
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
    ratePerMetre: 220,
    status: 'PASSED',
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
    ratePerMetre: 310,
    status: 'PASSED',
  },
];

// Initial mock invoices aligned with seed.ts
let mockInvoices: Invoice[] = [
  {
    id: 'inv_1',
    invoiceNo: 'INV-2026-001',
    dispatchId: 'dsp_1',
    dispatchNo: 'DSP-2026-001',
    orderId: 'ord_101',
    orderNumber: 'ORD-2026-001',
    buyerName: 'Nimesh Pathak Textiles',
    fabricType: 'Cotton Twill 2/1',
    colour: 'Bleached White',
    totalMetres: 200,
    ratePerMetre: 145,
    amount: 29000,
    paidAmount: 29000,
    outstandingAmount: 0,
    status: 'PAID',
    issuedAt: '2026-10-08T14:30:00Z',
    vehicleNo: 'MH-12-AB-1234',
    rolls: [
      { rollId: 'roll_seed_1', rollNo: 'ROLL-0000', metres: 200 },
    ],
    payments: [
      {
        id: 'pay_1',
        amount: 29000,
        paidOn: '2026-10-09',
        method: 'NEFT / Bank Transfer',
        reference: 'UTR-987123654',
        createdByName: 'Anjali Rao (Office)',
      },
    ],
  },
  {
    id: 'inv_2',
    invoiceNo: 'INV-2026-002',
    dispatchId: 'dsp_2',
    dispatchNo: 'DSP-2026-002',
    orderId: 'ord_103',
    orderNumber: 'ORD-2026-003',
    buyerName: 'Bombay Dyeing & Mfg',
    fabricType: 'Pure Linen Slub 60s',
    colour: 'Crimson Red',
    totalMetres: 350,
    ratePerMetre: 310,
    amount: 108500,
    paidAmount: 50000,
    outstandingAmount: 58500,
    status: 'PARTIAL',
    issuedAt: '2026-10-09T16:00:00Z',
    vehicleNo: 'GJ-01-XX-9900',
    rolls: [
      { rollId: 'roll_seed_2', rollNo: 'ROLL-0007', metres: 350 },
    ],
    payments: [
      {
        id: 'pay_2',
        amount: 50000,
        paidOn: '2026-10-10',
        method: 'Cheque Deposit',
        reference: 'CHQ-445566',
        createdByName: 'Anjali Rao (Office)',
      },
    ],
  },
];

let dispatchCounter = 3;
let invoiceCounter = 3;

/**
 * GET /api/v1/dispatch/goods
 * Returns finished rolls, optionally filtered by orderId
 */
export async function getFinishedGoods(orderId?: string): Promise<FinishedGoodItem[]> {
  try {
    const qs = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
    const res = await api<FinishedGoodItem[]>(`/dispatch/goods${qs}`);
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
  } catch {
    // fallback
  }

  let goods = [...mockFinishedGoods];
  if (orderId) {
    goods = goods.filter((g) => g.orderId === orderId);
  }
  return goods;
}

/**
 * GET /api/v1/dispatch/validate?code=X
 * Validates a roll code for dispatch
 */
export async function validateRoll(
  rollCode: string,
  targetOrderId?: string
): Promise<ValidateRollResult> {
  const cleanCode = rollCode.trim().toUpperCase();

  try {
    const qs = `?code=${encodeURIComponent(cleanCode)}${targetOrderId ? `&orderId=${encodeURIComponent(targetOrderId)}` : ''}`;
    const res = await api<ValidateRollResult>(`/dispatch/validate${qs}`);
    if (res && typeof res.valid === 'boolean') {
      return res;
    }
  } catch {
    // fallback to local store validation
  }

  const roll = mockFinishedGoods.find(
    (g) => g.rollNo.toUpperCase() === cleanCode || g.id.toUpperCase() === cleanCode
  );

  if (!roll) {
    return {
      valid: false,
      errorCode: 'UNKNOWN_ROLL',
      errorMessage: `Roll code "${cleanCode}" is not found in the factory records.`,
    };
  }

  if (roll.status === 'DISPATCHED') {
    return {
      valid: false,
      errorCode: 'ALREADY_DISPATCHED',
      errorMessage: `Roll "${roll.rollNo}" has already been dispatched.`,
      roll,
    };
  }

  if (roll.status !== 'PASSED') {
    return {
      valid: false,
      errorCode: 'NOT_PASSED',
      errorMessage: `Roll "${roll.rollNo}" has status "${roll.status}" and has not passed Quality Control.`,
      roll,
    };
  }

  if (targetOrderId && roll.orderId !== targetOrderId) {
    return {
      valid: false,
      errorCode: 'WRONG_ORDER',
      errorMessage: `Roll "${roll.rollNo}" belongs to order ${roll.orderNumber}, not the selected order.`,
      roll,
    };
  }

  return {
    valid: true,
    roll,
  };
}

/**
 * POST /api/v1/dispatch
 * Confirms dispatch of selected rolls, marks rolls DISPATCHED, and creates an invoice.
 */
export async function confirmDispatch(
  input: ConfirmDispatchInput
): Promise<ConfirmDispatchResponse> {
  try {
    const res = await api<ConfirmDispatchResponse>('/dispatch', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.invoice) {
      return res;
    }
  } catch (err) {
    console.warn('API confirmDispatch error, executing locally:', err);
  }

  // Local fallback
  const rollsToDispatch = mockFinishedGoods.filter(
    (r) => input.rollIds.includes(r.id) && r.orderId === input.orderId
  );

  if (rollsToDispatch.length === 0) {
    throw new Error('No valid passed rolls found for dispatch.');
  }

  // Update roll statuses to DISPATCHED
  rollsToDispatch.forEach((r) => {
    r.status = 'DISPATCHED';
  });

  const totalMetres = rollsToDispatch.reduce((acc, r) => acc + r.metres, 0);
  const ratePerMetre = rollsToDispatch[0].ratePerMetre || 150;
  const totalAmount = totalMetres * ratePerMetre;

  const dispatchNo = `DSP-2026-${String(dispatchCounter++).padStart(3, '0')}`;
  const invoiceNo = `INV-2026-${String(invoiceCounter++).padStart(3, '0')}`;
  const dispatchId = `dsp_${Date.now()}`;
  const invoiceId = `inv_${Date.now()}`;

  const firstRoll = rollsToDispatch[0];

  const newInvoice: Invoice = {
    id: invoiceId,
    invoiceNo,
    dispatchId,
    dispatchNo,
    orderId: input.orderId,
    orderNumber: firstRoll.orderNumber,
    buyerName: firstRoll.buyerName,
    fabricType: firstRoll.fabricType,
    colour: firstRoll.colour,
    totalMetres,
    ratePerMetre,
    amount: totalAmount,
    paidAmount: 0,
    outstandingAmount: totalAmount,
    status: 'UNPAID',
    issuedAt: new Date().toISOString(),
    vehicleNo: input.vehicleNo || undefined,
    rolls: rollsToDispatch.map((r) => ({
      rollId: r.id,
      rollNo: r.rollNo,
      metres: r.metres,
    })),
    payments: [],
  };

  mockInvoices = [newInvoice, ...mockInvoices];

  return {
    dispatch: {
      id: dispatchId,
      dispatchNo,
      orderId: input.orderId,
      orderNumber: firstRoll.orderNumber,
      vehicleNo: input.vehicleNo,
      dispatchedAt: new Date().toISOString(),
      totalMetres,
      rollCount: rollsToDispatch.length,
    },
    invoice: newInvoice,
  };
}

/**
 * GET /api/v1/invoices
 * Lists all customer invoices
 */
export async function listInvoices(): Promise<Invoice[]> {
  try {
    const res = await api<Invoice[]>('/invoices');
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
  } catch {
    // fallback
  }

  return [...mockInvoices];
}

/**
 * GET /api/v1/invoices/:id
 * Retrieves invoice by ID
 */
export async function getInvoice(id: string): Promise<Invoice> {
  try {
    const res = await api<Invoice>(`/invoices/${id}`);
    if (res && res.id) {
      return res;
    }
  } catch {
    // fallback
  }

  const found = mockInvoices.find((i) => i.id === id || i.invoiceNo === id);
  if (!found) {
    throw new Error(`Invoice "${id}" not found.`);
  }
  return found;
}

/**
 * POST /api/v1/invoices/:id/payments
 * Records a customer payment against an invoice
 */
export async function recordPayment(
  invoiceId: string,
  input: {
    amount: number;
    paidOn: string;
    method?: string;
    reference?: string;
  },
  userName = 'Office Staff'
): Promise<Invoice> {
  try {
    const res = await api<Invoice>(`/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    console.warn('API recordPayment error, executing locally:', err);
  }

  const idx = mockInvoices.findIndex((i) => i.id === invoiceId);
  if (idx === -1) throw new Error('Invoice not found');

  const inv = mockInvoices[idx];
  const newPayment: InvoicePayment = {
    id: `pay_${Date.now()}`,
    amount: Number(input.amount),
    paidOn: input.paidOn,
    method: input.method || 'Bank Transfer',
    reference: input.reference || undefined,
    createdByName: userName,
  };

  const updatedPaid = inv.paidAmount + Number(input.amount);
  const updatedOutstanding = Math.max(0, inv.amount - updatedPaid);
  const updatedStatus = updatedOutstanding <= 0 ? 'PAID' : 'PARTIAL';

  const updatedInvoice: Invoice = {
    ...inv,
    paidAmount: updatedPaid,
    outstandingAmount: updatedOutstanding,
    status: updatedStatus,
    payments: [newPayment, ...inv.payments],
  };

  mockInvoices[idx] = updatedInvoice;
  return updatedInvoice;
}
