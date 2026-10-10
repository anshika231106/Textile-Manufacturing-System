import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { notFound, unprocessable } from '../../lib/httpErrors';
import { ok, created } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { round2, toDecimal } from '../../lib/numbers';
import { invoiceInclude, mapInvoice } from '../../lib/invoiceMapper';

export const invoicesRoutes = Router();

// GET /invoices - list all invoices, newest first
invoicesRoutes.get(
  '/invoices',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  async (_req, res, next) => {
    try {
      const invoices = await prisma.invoice.findMany({
        orderBy: { issuedAt: 'desc' },
        include: invoiceInclude,
      });
      return ok(res, invoices.map(mapInvoice));
    } catch (err) {
      next(err);
    }
  }
);

const idParams = z.object({ id: z.string().uuid() });

// GET /invoices/:id - invoice detail
invoicesRoutes.get(
  '/invoices/:id',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  validate({ params: idParams }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
      if (!invoice) throw notFound('Invoice not found');
      return ok(res, mapInvoice(invoice));
    } catch (err) {
      next(err);
    }
  }
);

const paymentBody = z.object({
  amount: z.number().positive(),
  paidOn: z.string().min(1),
  method: z.string().trim().max(60).optional(),
});

// POST /invoices/:id/payments - record a buyer payment, guarded against overpayment (API-39)
invoicesRoutes.post(
  '/invoices/:id/payments',
  authenticate,
  authorize('OWNER', 'OFFICE'),
  validate({ params: idParams, body: paymentBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const input = paymentBody.parse(req.body);

      const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
      if (!invoice) throw notFound('Invoice not found');

      const amount = toDecimal(invoice.amount);
      const paidAmount = invoice.payments.reduce((sum, p) => sum + toDecimal(p.amount), 0);
      const outstanding = round2(Math.max(amount - paidAmount, 0));

      if (input.amount > outstanding + 0.005) {
        throw unprocessable('PAYMENT_EXCEEDS_BALANCE', 'Payment amount exceeds the outstanding balance', {
          outstanding,
          attempted: input.amount,
        });
      }

      await prisma.payment.create({
        data: {
          invoiceId: id,
          amount: input.amount,
          paidOn: new Date(input.paidOn),
          method: input.method,
          createdById: req.authUser!.id,
        },
      });

      const updated = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
      return created(res, mapInvoice(updated));
    } catch (err) {
      next(err);
    }
  }
);
