import { round2, toDecimal } from './numbers';

export const invoiceInclude = {
  dispatch: {
    include: {
      order: { include: { buyer: true } },
      items: { include: { roll: true } },
    },
  },
  payments: {
    include: { createdBy: { select: { name: true } } },
    orderBy: { paidOn: 'desc' as const },
  },
};

export function mapInvoice(inv: any) {
  const amount = toDecimal(inv.amount);
  const paidAmount = inv.payments.reduce((sum: number, p: any) => sum + toDecimal(p.amount), 0);
  const outstandingAmount = round2(Math.max(amount - paidAmount, 0));
  const status = outstandingAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
  const totalMetres = inv.dispatch.items.reduce((sum: number, it: any) => sum + toDecimal(it.metres), 0);

  return {
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    dispatchId: inv.dispatchId,
    dispatchNo: inv.dispatch.dispatchNo,
    orderId: inv.orderId,
    orderNumber: inv.dispatch.order.orderNo,
    buyerName: inv.dispatch.order.buyer.name,
    fabricType: inv.dispatch.order.fabricType,
    colour: inv.dispatch.order.colour,
    totalMetres: round2(totalMetres),
    ratePerMetre: Number(inv.dispatch.order.ratePerMetre),
    amount: round2(amount),
    paidAmount: round2(paidAmount),
    outstandingAmount,
    status,
    issuedAt: inv.issuedAt.toISOString(),
    vehicleNo: inv.dispatch.vehicleNo ?? undefined,
    rolls: inv.dispatch.items.map((it: any) => ({
      rollId: it.rollId,
      rollNo: it.roll.rollNo,
      metres: toDecimal(it.metres),
    })),
    payments: inv.payments.map((p: any) => ({
      id: p.id,
      amount: toDecimal(p.amount),
      paidOn: p.paidOn.toISOString().split('T')[0],
      method: p.method ?? undefined,
      createdByName: p.createdBy?.name,
    })),
  };
}
