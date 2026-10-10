import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { badRequest, conflict, notFound } from '../../lib/httpErrors';
import { ok, created } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { round2, toDecimal } from '../../lib/numbers';
import { invoiceInclude, mapInvoice } from '../../lib/invoiceMapper';

export const dispatchRoutes = Router();

function mapFinishedGood(roll: any) {
  return {
    id: roll.id,
    rollNo: roll.rollNo,
    orderId: roll.orderId,
    orderNumber: roll.order.orderNo,
    buyerName: roll.order.buyer.name,
    fabricType: roll.order.fabricType,
    colour: roll.order.colour,
    metres: toDecimal(roll.metres),
    ratePerMetre: Number(roll.order.ratePerMetre),
    status: roll.status,
  };
}

const goodsQuery = z.object({ orderId: z.string().uuid().optional() });

// GET /dispatch/goods?orderId= - rolls for the dispatch screen, optionally scoped to one order
dispatchRoutes.get(
  '/dispatch/goods',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  validate({ query: goodsQuery }),
  async (req, res, next) => {
    try {
      const { orderId } = req.query as { orderId?: string };
      const rolls = await prisma.roll.findMany({
        where: orderId ? { orderId } : {},
        orderBy: { createdAt: 'desc' },
        include: { order: { include: { buyer: true } } },
      });
      return ok(res, rolls.map(mapFinishedGood));
    } catch (err) {
      next(err);
    }
  }
);

const validateQuery = z.object({ code: z.string().min(1), orderId: z.string().uuid().optional() });

// GET /dispatch/validate?code=&orderId= - validate a scanned/typed roll code (US-11)
dispatchRoutes.get(
  '/dispatch/validate',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  validate({ query: validateQuery }),
  async (req, res, next) => {
    try {
      const { code, orderId } = req.query as { code: string; orderId?: string };
      const clean = code.trim().toUpperCase();

      const roll = await prisma.roll.findFirst({
        where: { rollNo: { equals: clean, mode: 'insensitive' } },
        include: { order: { include: { buyer: true } } },
      });

      if (!roll) {
        return ok(res, {
          valid: false,
          errorCode: 'UNKNOWN_ROLL',
          errorMessage: `Roll code "${clean}" is not found in the factory records.`,
        });
      }

      const rollPayload = mapFinishedGood(roll);

      if (roll.status === 'DISPATCHED') {
        return ok(res, {
          valid: false,
          errorCode: 'ALREADY_DISPATCHED',
          errorMessage: `Roll "${roll.rollNo}" has already been dispatched.`,
          roll: rollPayload,
        });
      }
      if (roll.status !== 'PASSED') {
        return ok(res, {
          valid: false,
          errorCode: 'NOT_PASSED',
          errorMessage: `Roll "${roll.rollNo}" has status "${roll.status}" and has not passed Quality Control.`,
          roll: rollPayload,
        });
      }
      if (orderId && roll.orderId !== orderId) {
        return ok(res, {
          valid: false,
          errorCode: 'WRONG_ORDER',
          errorMessage: `Roll "${roll.rollNo}" belongs to order ${roll.order.orderNo}, not the selected order.`,
          roll: rollPayload,
        });
      }

      return ok(res, { valid: true, roll: rollPayload });
    } catch (err) {
      next(err);
    }
  }
);

const confirmBody = z.object({
  orderId: z.string().uuid(),
  rollIds: z.array(z.string().uuid()).min(1),
  vehicleNo: z.string().trim().max(40).optional(),
});

// POST /dispatch - confirm dispatch of PASSED rolls, create the invoice, in one transaction (API-34)
dispatchRoutes.post(
  '/dispatch',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ body: confirmBody }),
  async (req, res, next) => {
    try {
      const input = confirmBody.parse(req.body);
      const uniqueRollIds = Array.from(new Set(input.rollIds));
      if (uniqueRollIds.length !== input.rollIds.length) {
        throw badRequest('DUPLICATE_ROLLS', 'rollIds must not contain duplicates');
      }

      const order = await prisma.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw notFound('Order not found');

      const result = await prisma.$transaction(async (tx) => {
        // Conditional update: only rolls that are still PASSED and belong to this order flip to DISPATCHED.
        // If a concurrent dispatch already claimed one, the count mismatches and we roll back.
        const updateResult = await tx.roll.updateMany({
          where: { id: { in: uniqueRollIds }, orderId: input.orderId, status: 'PASSED' },
          data: { status: 'DISPATCHED' },
        });
        if (updateResult.count !== uniqueRollIds.length) {
          throw conflict(
            'ROLL_NOT_DISPATCHABLE',
            'One or more rolls are not PASSED rolls of this order, or have already been dispatched'
          );
        }

        const dispatchedRolls = await tx.roll.findMany({ where: { id: { in: uniqueRollIds } } });

        const dispatchCounter = await tx.counter.upsert({
          where: { key: 'dispatch' },
          update: { value: { increment: 1 } },
          create: { key: 'dispatch', value: 1 },
        });
        const dispatchNo = `DSP-${String(dispatchCounter.value).padStart(4, '0')}`;

        const dispatch = await tx.dispatch.create({
          data: {
            dispatchNo,
            orderId: input.orderId,
            vehicleNo: input.vehicleNo,
            createdById: req.authUser!.id,
            items: {
              create: dispatchedRolls.map((r) => ({ rollId: r.id, metres: r.metres })),
            },
          },
        });

        const totalMetres = dispatchedRolls.reduce((sum, r) => sum + toDecimal(r.metres), 0);
        const amount = round2(totalMetres * Number(order.ratePerMetre));

        const invoiceCounter = await tx.counter.upsert({
          where: { key: 'invoice' },
          update: { value: { increment: 1 } },
          create: { key: 'invoice', value: 1 },
        });
        const invoiceNo = `INV-${String(invoiceCounter.value).padStart(4, '0')}`;

        const invoice = await tx.invoice.create({
          data: { invoiceNo, dispatchId: dispatch.id, orderId: input.orderId, amount },
        });

        return { dispatch, invoice, totalMetres, rollCount: dispatchedRolls.length };
      });

      const fullInvoice = await prisma.invoice.findUnique({
        where: { id: result.invoice.id },
        include: invoiceInclude,
      });

      return created(res, {
        dispatch: {
          id: result.dispatch.id,
          dispatchNo: result.dispatch.dispatchNo,
          orderId: result.dispatch.orderId,
          orderNumber: order.orderNo,
          vehicleNo: result.dispatch.vehicleNo ?? undefined,
          dispatchedAt: result.dispatch.dispatchedAt.toISOString(),
          totalMetres: round2(result.totalMetres),
          rollCount: result.rollCount,
        },
        invoice: mapInvoice(fullInvoice),
      });
    } catch (err) {
      next(err);
    }
  }
);
