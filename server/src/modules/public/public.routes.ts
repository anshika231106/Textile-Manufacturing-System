import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpErrors';
import { ok } from '../../lib/respond';
import { deriveOrderStatus } from '../../domain/orderStatus';
import { round2, toDecimal } from '../../lib/numbers';
import { ordersService } from '../orders/orders.service';

export const publicRoutes = Router();

// API-46: GET /public/track/:token - buyer-facing order status, no login required.
// Only safe fields are returned: no rates, no costs, no other buyer's data.
publicRoutes.get(['/track/:token', '/public/track/:token'], async (req, res, next) => {
  try {
    const { token } = req.params;
    const order = await prisma.order.findUnique({
      where: { trackingToken: token },
      include: {
        stageJobs: true,
        rolls: { select: { status: true, metres: true, createdAt: true } },
      },
    });
    if (!order) throw notFound('Tracking link not found');

    let pendingQc = 0;
    let rework = 0;
    let passed = 0;
    let rejected = 0;
    let dispatched = 0;
    let passedMetres = 0;
    let dispatchedMetres = 0;

    for (const roll of order.rolls) {
      const m = toDecimal(roll.metres);
      if (roll.status === 'PENDING_QC') pendingQc++;
      else if (roll.status === 'REWORK') rework++;
      else if (roll.status === 'PASSED') {
        passed++;
        passedMetres += m;
      } else if (roll.status === 'REJECTED') rejected++;
      else if (roll.status === 'DISPATCHED') {
        dispatched++;
        dispatchedMetres += m;
      }
    }

    const rollCounts = {
      total: order.rolls.length,
      pendingQc,
      rework,
      passed,
      rejected,
      dispatched,
    };

    const derived = deriveOrderStatus({
      startedAt: order.startedAt,
      hasJobs: order.stageJobs.length > 0,
      rolls: rollCounts,
    });

    let currentStage: string | null = null;
    if (order.stageJobs.length > 0) {
      currentStage = order.stageJobs[order.stageJobs.length - 1].stage;
    } else if (order.startedAt) {
      currentStage = 'SPINNING';
    }

    const dyeingOutputAgg = await prisma.productionLog.aggregate({
      where: { orderId: order.id, stage: 'DYEING' },
      _sum: { metres: true },
    });
    const producedMetres = toDecimal(dyeingOutputAgg._sum.metres);

    const updateTimestamps = [
      order.createdAt,
      order.startedAt,
      ...order.stageJobs.map((j) => j.endedAt ?? j.startedAt),
      ...order.rolls.map((r) => r.createdAt),
    ].filter((d): d is Date => !!d);
    const lastUpdated = updateTimestamps.length
      ? new Date(Math.max(...updateTimestamps.map((d) => d.getTime())))
      : order.createdAt;

    return ok(res, {
      orderNumber: order.orderNo,
      status: derived.clientStatus,
      currentStage: currentStage,
      orderedMetres: Number(order.metres),
      producedMetres: round2(producedMetres),
      passedMetres: round2(passedMetres),
      dispatchedMetres: round2(dispatchedMetres),
      deadline: order.deadline.toISOString().split('T')[0],
      lastUpdated: lastUpdated.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
