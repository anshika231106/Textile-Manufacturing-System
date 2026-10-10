import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { ok } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { round2, toDecimal } from '../../lib/numbers';
import { computeYarnStock } from '../../domain/stock';
import { deriveOrderStatus } from '../../domain/orderStatus';

export const reportsRoutes = Router();

const DEFAULT_DAILY_WAGE = 550;

// GET /reports/dashboard - live operational snapshot for the home screen
reportsRoutes.get(
  '/reports/dashboard',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  async (_req, res, next) => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const [orders, machines, rollsAwaitingQc, metresTodayAgg, yarnTypes, allMovements, unstartedOrders] =
        await Promise.all([
          prisma.order.findMany({
            select: {
              startedAt: true,
              stageJobs: { select: { id: true } },
              rolls: { select: { status: true } },
            },
          }),
          prisma.machine.findMany({ select: { status: true } }),
          prisma.roll.count({ where: { status: { in: ['PENDING_QC', 'REWORK'] } } }),
          prisma.productionLog.aggregate({
            where: { loggedAt: { gte: today } },
            _sum: { metres: true },
          }),
          prisma.yarnType.findMany({ select: { id: true, reorderLevelKg: true } }),
          prisma.stockMovement.findMany({ select: { yarnTypeId: true, type: true, kg: true } }),
          prisma.order.findMany({
            where: { stageJobs: { none: {} } },
            select: { metres: true, requirements: { select: { yarnTypeId: true, kgPerMetre: true } } },
          }),
        ]);

      const statusCounts = new Map<string, number>();
      for (const order of orders) {
        let pendingQc = 0, rework = 0, passed = 0, rejected = 0, dispatched = 0;
        for (const r of order.rolls) {
          if (r.status === 'PENDING_QC') pendingQc++;
          else if (r.status === 'REWORK') rework++;
          else if (r.status === 'PASSED') passed++;
          else if (r.status === 'REJECTED') rejected++;
          else if (r.status === 'DISPATCHED') dispatched++;
        }
        const derived = deriveOrderStatus({
          startedAt: order.startedAt,
          hasJobs: order.stageJobs.length > 0,
          rolls: { total: order.rolls.length, pendingQc, rework, passed, rejected, dispatched },
        });
        statusCounts.set(derived.clientStatus, (statusCounts.get(derived.clientStatus) || 0) + 1);
      }

      const onHandMap = new Map<string, number>();
      for (const m of allMovements) {
        const qty = toDecimal(m.kg);
        const current = onHandMap.get(m.yarnTypeId) || 0;
        onHandMap.set(m.yarnTypeId, m.type === 'RECEIPT' ? current + qty : current - qty);
      }
      const reservedMap = new Map<string, number>();
      for (const order of unstartedOrders) {
        const orderMetres = toDecimal(order.metres);
        for (const req of order.requirements) {
          const requiredKg = toDecimal(req.kgPerMetre) * orderMetres;
          reservedMap.set(req.yarnTypeId, (reservedMap.get(req.yarnTypeId) || 0) + requiredKg);
        }
      }
      let lowStockYarnCount = 0;
      for (const yt of yarnTypes) {
        const computed = computeYarnStock({
          onHandKg: onHandMap.get(yt.id) || 0,
          reservedKg: reservedMap.get(yt.id) || 0,
          reorderLevelKg: Number(yt.reorderLevelKg),
        });
        if (computed.isLow) lowStockYarnCount++;
      }

      return ok(res, {
        ordersByStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
        machinesRunning: machines.filter((m) => m.status === 'RUNNING').length,
        machinesIdle: machines.filter((m) => m.status === 'IDLE').length,
        machinesBreakdown: machines.filter((m) => m.status === 'BREAKDOWN').length,
        lowStockYarnCount,
        rollsAwaitingQc,
        metresTodayProduced: round2(toDecimal(metresTodayAgg._sum.metres)),
      });
    } catch (err) {
      next(err);
    }
  }
);

const monthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM') });

// GET /reports/month-end?month=YYYY-MM - purchases, wages, invoiced, received, profit, cost per order (API-44)
reportsRoutes.get(
  '/reports/month-end',
  authenticate,
  authorize('OWNER', 'OFFICE'),
  validate({ query: monthQuery }),
  async (req, res, next) => {
    try {
      const { month } = req.query as { month: string };
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);

      const [receipts, staff, presentRecords, invoicesInMonth, paymentsInMonth, startedOrders, machines, productionLogs] =
        await Promise.all([
          prisma.stockMovement.findMany({
            where: { type: 'RECEIPT', occurredAt: { gte: start, lt: end } },
            select: { kg: true, ratePerKg: true },
          }),
          prisma.user.findMany({ where: { role: 'STAFF' }, select: { id: true, dailyWage: true } }),
          prisma.attendance.findMany({
            where: { date: { gte: start, lt: end }, present: true },
            select: { staffId: true },
          }),
          prisma.invoice.findMany({
            where: { issuedAt: { gte: start, lt: end } },
            select: { amount: true, orderId: true },
          }),
          prisma.payment.findMany({
            where: { paidOn: { gte: start, lt: end } },
            select: { amount: true },
          }),
          prisma.order.findMany({
            where: { startedAt: { not: null } },
            select: { id: true, orderNo: true, fabricType: true, metres: true, buyer: { select: { name: true } } },
          }),
          prisma.machine.findMany({
            select: { id: true, code: true, name: true, stage: true, ratePerMetre: true },
          }),
          prisma.productionLog.findMany({
            select: { orderId: true, machineId: true, metres: true },
          }),
        ]);

      const purchases = round2(receipts.reduce((sum, r) => sum + toDecimal(r.kg) * toDecimal(r.ratePerKg), 0));

      const presentCount = new Map<string, number>();
      for (const r of presentRecords) presentCount.set(r.staffId, (presentCount.get(r.staffId) || 0) + 1);
      const wages = round2(
        staff.reduce((sum, w) => {
          const dailyWage = w.dailyWage ? toDecimal(w.dailyWage) : DEFAULT_DAILY_WAGE;
          return sum + (presentCount.get(w.id) || 0) * dailyWage;
        }, 0)
      );

      const invoicedAmountByOrder = new Map<string, number>();
      for (const inv of invoicesInMonth) {
        invoicedAmountByOrder.set(inv.orderId, (invoicedAmountByOrder.get(inv.orderId) || 0) + toDecimal(inv.amount));
      }
      const invoiced = round2(invoicesInMonth.reduce((sum, inv) => sum + toDecimal(inv.amount), 0));
      const paymentsReceived = round2(paymentsInMonth.reduce((sum, p) => sum + toDecimal(p.amount), 0));
      const profit = round2(invoiced - purchases - wages);

      // Yarn cost per order: sum of ISSUE movements recorded against that order.
      const orderIds = startedOrders.map((o) => o.id);
      const issueMovements = orderIds.length
        ? await prisma.stockMovement.findMany({
            where: { orderId: { in: orderIds }, type: 'ISSUE' },
            select: { orderId: true, kg: true, ratePerKg: true },
          })
        : [];
      const yarnCostByOrder = new Map<string, number>();
      for (const m of issueMovements) {
        const cost = toDecimal(m.kg) * toDecimal(m.ratePerKg);
        yarnCostByOrder.set(m.orderId!, (yarnCostByOrder.get(m.orderId!) || 0) + cost);
      }

      const machineById = new Map(machines.map((m) => [m.id, m]));
      const machineCostByOrder = new Map<string, number>();
      const metresByMachine = new Map<string, number>();
      for (const log of productionLogs) {
        const metres = toDecimal(log.metres);
        metresByMachine.set(log.machineId, (metresByMachine.get(log.machineId) || 0) + metres);
        const machine = machineById.get(log.machineId);
        if (machine) {
          const cost = metres * toDecimal(machine.ratePerMetre);
          machineCostByOrder.set(log.orderId, (machineCostByOrder.get(log.orderId) || 0) + cost);
        }
      }

      const costPerOrder = startedOrders.map((order) => {
        const yarnCost = round2(yarnCostByOrder.get(order.id) || 0);
        const machineCost = round2(machineCostByOrder.get(order.id) || 0);
        const invoicedAmount = round2(invoicedAmountByOrder.get(order.id) || 0);
        const marginAmount = round2(invoicedAmount - yarnCost - machineCost);
        const marginPercent = invoicedAmount > 0 ? round2((marginAmount / invoicedAmount) * 100) : 0;
        return {
          orderId: order.id,
          orderNumber: order.orderNo,
          buyerName: order.buyer.name,
          fabricType: order.fabricType,
          metres: Number(order.metres),
          yarnCost,
          machineCost,
          invoicedAmount,
          marginAmount,
          marginPercent,
        };
      });

      const jobsByMachine = await prisma.stageJob.findMany({
        select: { machineId: true, startedAt: true, endedAt: true },
      });
      const hoursByMachine = new Map<string, number>();
      const now = new Date();
      for (const job of jobsByMachine) {
        const end = job.endedAt ?? now;
        const hours = Math.max(0, (end.getTime() - job.startedAt.getTime()) / 3_600_000);
        hoursByMachine.set(job.machineId, (hoursByMachine.get(job.machineId) || 0) + hours);
      }

      const metresPerMachine = machines.map((m) => {
        const metresProduced = round2(metresByMachine.get(m.id) || 0);
        return {
          machineId: m.id,
          machineCode: m.code,
          machineName: m.name,
          stage: m.stage,
          metresProduced,
          hoursActive: round2(hoursByMachine.get(m.id) || 0),
          costTotal: round2(metresProduced * toDecimal(m.ratePerMetre)),
        };
      });

      return ok(res, {
        month,
        purchases,
        wages,
        invoiced,
        paymentsReceived,
        profit,
        costPerOrder,
        metresPerMachine,
      });
    } catch (err) {
      next(err);
    }
  }
);
