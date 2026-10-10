import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { ok } from '../../lib/respond';
import { round2 } from '../../lib/numbers';
import { ordersService } from '../orders/orders.service';

export const publicRoutes = Router();

// API-46: Public Order Tracking Lookup (buyer & landing page)
// Accessible via /api/v1/public/track/:token AND /api/v1/public/public/track/:token
publicRoutes.get(['/track/:token', '/public/track/:token'], async (req, res, next) => {
  try {
    const { token } = req.params;
    const orderData = await ordersService.getOrderByTokenOrNumber(token);
    return ok(res, orderData);
  } catch (err) {
    next(err);
  }
});

// Public live order samples for landing page demo chips
publicRoutes.get(['/samples', '/orders/samples', '/public/samples'], async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: true,
        requirements: { include: { yarnType: true } },
        stageJobs: { include: { machine: true, logs: true } },
        rolls: true,
      },
    });

    const samples = orders.map((order) => {
      const detail = ordersService.formatOrderDetail(order);
      let hint = 'In Production';
      if (detail.status === 'DISPATCHED' || detail.status === 'COMPLETED') hint = 'Dispatched Roll';
      else if (detail.status === 'READY') hint = 'Ready to Ship';
      else if (detail.status === 'QC') hint = 'Rolls in QC';
      else if (detail.status === 'PENDING') hint = 'Spinning Queue';
      else if (detail.currentStage === 'WEAVING') hint = 'Active on Loom';
      else if (detail.currentStage === 'DYEING') hint = 'Continuous Dyeing';
      else if (detail.currentStage === 'SPINNING') hint = 'Active on Spindle';

      return {
        code: order.orderNo,
        trackingToken: order.trackingToken,
        label: `${order.fabricType} · ${detail.currentStage || detail.status}`,
        hint,
        buyerName: order.buyer.name,
        status: detail.status,
        currentStage: detail.currentStage,
        metres: Number(order.metres),
        fabricType: order.fabricType,
        colour: order.colour,
      };
    });

    return ok(res, samples);
  } catch (err) {
    next(err);
  }
});

// Public mill operational intelligence metrics for landing page showcase
publicRoutes.get(['/stats', '/public/stats'], async (req, res, next) => {
  try {
    const [totalRolls, passedRolls, totalMachines, runningMachines, productionLogsSum] = await Promise.all([
      prisma.roll.count(),
      prisma.roll.count({ where: { status: { in: ['PASSED', 'DISPATCHED'] } } }),
      prisma.machine.count(),
      prisma.machine.count({ where: { status: 'RUNNING' } }),
      prisma.productionLog.aggregate({ _sum: { metres: true } }),
    ]);

    const totalMetresProduced = Number(productionLogsSum._sum.metres ?? 0);
    const qcPassPercentage = totalRolls > 0 ? round2((passedRolls / totalRolls) * 100) : 99.4;

    return ok(res, {
      totalMachines,
      runningMachines,
      totalMetresProduced,
      totalRolls,
      passedRolls,
      firstPassQcRate: qcPassPercentage,
    });
  } catch (err) {
    next(err);
  }
});
