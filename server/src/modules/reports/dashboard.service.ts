import { prisma } from '../../db/prisma';
import { round2, round3, toDecimal } from '../../lib/numbers';
import { computeYarnStock } from '../../domain/stock';
import { deriveOrderStatus } from '../../domain/orderStatus';
import type { Role, Stage } from '../../../generated/prisma/client';

const STAGES: Stage[] = ['SPINNING', 'WEAVING', 'DYEING'];
const TREND_DAYS = 14;
const UPCOMING_LIMIT = 8;
const ACTIVITY_LIMIT = 12;
const DAY_MS = 86_400_000;

/** Local calendar key (YYYY-MM-DD) - matches how the client sends attendance / deadline dates. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** @db.Date columns are stored as UTC midnight of the calendar day. */
function dateOnly(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

type ActivityType = 'PRODUCTION' | 'QC' | 'DISPATCH' | 'RECEIPT' | 'PAYMENT';

interface ActivityItem {
  type: ActivityType;
  at: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
}

/**
 * Live operational snapshot for the dashboard home screen.
 * Finance figures are only included for OWNER / OFFICE.
 */
export async function buildDashboard(role: Role) {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayKey = dayKey(now);
  const trendStart = new Date(todayStart.getTime() - (TREND_DAYS - 1) * DAY_MS);
  const weekAgo = new Date(todayStart.getTime() - 6 * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const showFinance = role === 'OWNER' || role === 'OFFICE';

  const [
    orders,
    logMetresByOrderStage,
    rollMetresByOrderStatus,
    machines,
    trendLogs,
    yarnTypes,
    movementTotals,
    unstartedOrders,
    qcLast7,
    staffCount,
    attendanceToday,
  ] = await Promise.all([
    prisma.order.findMany({
      select: {
        id: true,
        orderNo: true,
        fabricType: true,
        colour: true,
        metres: true,
        deadline: true,
        startedAt: true,
        buyer: { select: { name: true } },
        _count: { select: { stageJobs: true } },
        stageJobs: { where: { stage: 'DYEING' }, orderBy: { startedAt: 'desc' }, take: 1, select: { status: true } },
      },
    }),
    prisma.productionLog.groupBy({ by: ['orderId', 'stage'], _sum: { metres: true } }),
    prisma.roll.groupBy({ by: ['orderId', 'status'], _sum: { metres: true }, _count: { _all: true } }),
    prisma.machine.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        stage: true,
        status: true,
        statusNote: true,
        statusUpdatedAt: true,
        assignedStaff: { select: { name: true } },
        productionLogs: { where: { loggedAt: { gte: todayStart } }, select: { metres: true } },
      },
      orderBy: [{ stage: 'asc' }, { code: 'asc' }],
    }),
    prisma.productionLog.findMany({
      where: { loggedAt: { gte: trendStart } },
      select: { loggedAt: true, stage: true, shift: true, metres: true },
    }),
    prisma.yarnType.findMany({
      select: { id: true, code: true, name: true, colour: true, reorderLevelKg: true },
      orderBy: { code: 'asc' },
    }),
    prisma.stockMovement.groupBy({ by: ['yarnTypeId', 'type'], _sum: { kg: true } }),
    prisma.order.findMany({
      where: { stageJobs: { none: {} } },
      select: { metres: true, requirements: { select: { yarnTypeId: true, kgPerMetre: true } } },
    }),
    prisma.qcRecord.findMany({
      where: { checkedAt: { gte: weekAgo } },
      select: { result: true, defectType: true },
    }),
    prisma.user.count({ where: { role: 'STAFF', deletedAt: null } }),
    prisma.attendance.findMany({ where: { date: dateOnly(todayKey) }, select: { present: true } }),
  ]);

  // ── Orders ──────────────────────────────────────────────────────────────────
  const stageMetresByOrder = new Map<string, Record<Stage, number>>();
  for (const row of logMetresByOrderStage) {
    const entry = stageMetresByOrder.get(row.orderId) ?? { SPINNING: 0, WEAVING: 0, DYEING: 0 };
    entry[row.stage] += toDecimal(row._sum.metres);
    stageMetresByOrder.set(row.orderId, entry);
  }

  type RollTally = { total: number; pendingQc: number; rework: number; passed: number; rejected: number; dispatched: number; passedMetres: number; dispatchedMetres: number };
  const rollsByOrder = new Map<string, RollTally>();
  let readyRolls = 0;
  let readyMetres = 0;
  let awaitingQcMetres = 0;
  for (const row of rollMetresByOrderStatus) {
    const t = rollsByOrder.get(row.orderId) ?? { total: 0, pendingQc: 0, rework: 0, passed: 0, rejected: 0, dispatched: 0, passedMetres: 0, dispatchedMetres: 0 };
    const count = row._count._all;
    const metres = toDecimal(row._sum.metres);
    t.total += count;
    if (row.status === 'PENDING_QC') { t.pendingQc += count; awaitingQcMetres += metres; }
    else if (row.status === 'REWORK') { t.rework += count; awaitingQcMetres += metres; }
    else if (row.status === 'PASSED') { t.passed += count; t.passedMetres += metres; readyRolls += count; readyMetres += metres; }
    else if (row.status === 'REJECTED') t.rejected += count;
    else if (row.status === 'DISPATCHED') { t.dispatched += count; t.dispatchedMetres += metres; }
    rollsByOrder.set(row.orderId, t);
  }

  const todayDate = dateOnly(todayKey);
  const statusCounts = new Map<string, number>();
  const activeOrders = [];
  for (const order of orders) {
    const rolls = rollsByOrder.get(order.id);
    const { clientStatus } = deriveOrderStatus({
      startedAt: order.startedAt,
      hasJobs: order._count.stageJobs > 0,
      dyeingDone: order.stageJobs[0]?.status === 'COMPLETED',
      rolls,
    });
    statusCounts.set(clientStatus, (statusCounts.get(clientStatus) || 0) + 1);
    if (clientStatus === 'COMPLETED') continue;

    const metres = toDecimal(order.metres);
    const stageMetres = stageMetresByOrder.get(order.id) ?? { SPINNING: 0, WEAVING: 0, DYEING: 0 };
    const dispatchedMetres = rolls?.dispatchedMetres ?? 0;
    // Progress = mean completion of the three production stages plus dispatch.
    const frac = (v: number) => (metres > 0 ? Math.min(1, v / metres) : 0);
    const progressPercent = Math.round(
      ((frac(stageMetres.SPINNING) + frac(stageMetres.WEAVING) + frac(stageMetres.DYEING) + frac(dispatchedMetres)) / 4) * 100
    );
    const daysLeft = Math.round((order.deadline.getTime() - todayDate.getTime()) / DAY_MS);

    activeOrders.push({
      id: order.id,
      orderNo: order.orderNo,
      buyerName: order.buyer.name,
      fabricType: order.fabricType,
      colour: order.colour,
      metres: round2(metres),
      deadline: order.deadline.toISOString().slice(0, 10),
      daysLeft,
      status: clientStatus,
      stageMetres: {
        SPINNING: round2(stageMetres.SPINNING),
        WEAVING: round2(stageMetres.WEAVING),
        DYEING: round2(stageMetres.DYEING),
      },
      dispatchedMetres: round2(dispatchedMetres),
      progressPercent,
    });
  }
  activeOrders.sort((a, b) => a.daysLeft - b.daysLeft);
  const overdueOrders = activeOrders.filter((o) => o.daysLeft < 0).length;
  const dueThisWeek = activeOrders.filter((o) => o.daysLeft >= 0 && o.daysLeft <= 7).length;
  const activeMetres = activeOrders.reduce((sum, o) => sum + o.metres, 0);

  // ── Production trend ────────────────────────────────────────────────────────
  const trendMap = new Map<string, Record<Stage, number>>();
  for (let i = 0; i < TREND_DAYS; i++) {
    trendMap.set(dayKey(new Date(trendStart.getTime() + i * DAY_MS)), { SPINNING: 0, WEAVING: 0, DYEING: 0 });
  }
  const shiftToday = { MORNING: 0, EVENING: 0, NIGHT: 0 };
  for (const log of trendLogs) {
    const metres = toDecimal(log.metres);
    const bucket = trendMap.get(dayKey(log.loggedAt));
    if (bucket) bucket[log.stage] += metres;
    if (log.loggedAt >= todayStart) shiftToday[log.shift] += metres;
  }
  const trend = Array.from(trendMap.entries()).map(([date, s]) => ({
    date,
    SPINNING: round2(s.SPINNING),
    WEAVING: round2(s.WEAVING),
    DYEING: round2(s.DYEING),
    total: round2(s.SPINNING + s.WEAVING + s.DYEING),
  }));
  const sumDays = (from: number, to: number) => round2(trend.slice(from, to).reduce((sum, d) => sum + d.total, 0));
  const metresToday = trend[TREND_DAYS - 1].total;

  // ── Machines ────────────────────────────────────────────────────────────────
  const byStage = STAGES.map((stage) => {
    const list = machines.filter((m) => m.stage === stage);
    return {
      stage,
      total: list.length,
      running: list.filter((m) => m.status === 'RUNNING').length,
      idle: list.filter((m) => m.status === 'IDLE').length,
      breakdown: list.filter((m) => m.status === 'BREAKDOWN').length,
      metresToday: round2(list.reduce((sum, m) => sum + m.productionLogs.reduce((s, l) => s + toDecimal(l.metres), 0), 0)),
      machines: list.map((m) => ({ id: m.id, code: m.code, name: m.name, status: m.status })),
    };
  });
  const machinesRunning = machines.filter((m) => m.status === 'RUNNING').length;
  const machinesIdle = machines.filter((m) => m.status === 'IDLE').length;
  const machinesBreakdown = machines.filter((m) => m.status === 'BREAKDOWN').length;
  const breakdowns = machines
    .filter((m) => m.status === 'BREAKDOWN')
    .map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      stage: m.stage,
      note: m.statusNote,
      since: m.statusUpdatedAt?.toISOString() ?? null,
      assignedTo: m.assignedStaff?.name ?? null,
    }));

  // ── Yarn stock ──────────────────────────────────────────────────────────────
  const onHand = new Map<string, number>();
  for (const row of movementTotals) {
    const kg = toDecimal(row._sum.kg);
    onHand.set(row.yarnTypeId, (onHand.get(row.yarnTypeId) || 0) + (row.type === 'RECEIPT' ? kg : -kg));
  }
  const reserved = new Map<string, number>();
  for (const order of unstartedOrders) {
    const orderMetres = toDecimal(order.metres);
    for (const req of order.requirements) {
      reserved.set(req.yarnTypeId, (reserved.get(req.yarnTypeId) || 0) + toDecimal(req.kgPerMetre) * orderMetres);
    }
  }
  const yarns = yarnTypes.map((yt) => {
    const onHandKg = onHand.get(yt.id) || 0;
    const reservedKg = reserved.get(yt.id) || 0;
    const reorderLevelKg = toDecimal(yt.reorderLevelKg);
    const computed = computeYarnStock({ onHandKg, reservedKg, reorderLevelKg });
    return {
      id: yt.id,
      code: yt.code,
      name: yt.name,
      colour: yt.colour,
      onHandKg: round3(onHandKg),
      reservedKg: round3(reservedKg),
      reorderLevelKg: round3(reorderLevelKg),
      ...computed,
    };
  });
  const lowStock = yarns
    .filter((y) => y.isLow)
    .sort((a, b) => b.shortfallKg - a.shortfallKg || a.availableKg / (a.reorderLevelKg || 1) - b.availableKg / (b.reorderLevelKg || 1));

  // ── Quality ─────────────────────────────────────────────────────────────────
  const qc = { pass: 0, rework: 0, reject: 0 };
  const defectCounts = new Map<string, number>();
  for (const r of qcLast7) {
    if (r.result === 'PASS') qc.pass++;
    else if (r.result === 'REWORK') qc.rework++;
    else qc.reject++;
    if (r.defectType) defectCounts.set(r.defectType, (defectCounts.get(r.defectType) || 0) + 1);
  }
  const inspected = qc.pass + qc.rework + qc.reject;
  const rollsAwaitingQc = Array.from(rollsByOrder.values()).reduce((sum, t) => sum + t.pendingQc + t.rework, 0);

  // ── Workforce ───────────────────────────────────────────────────────────────
  const presentToday = attendanceToday.filter((a) => a.present).length;

  // ── Finance (OWNER / OFFICE only) ───────────────────────────────────────────
  let finance = null;
  if (showFinance) {
    const [invoices, paymentsThisMonth, receiptsThisMonth] = await Promise.all([
      prisma.invoice.findMany({
        select: {
          amount: true,
          issuedAt: true,
          order: { select: { buyer: { select: { name: true } } } },
          payments: { select: { amount: true } },
        },
      }),
      prisma.payment.aggregate({ where: { paidOn: { gte: dateOnly(dayKey(monthStart)) } }, _sum: { amount: true } }),
      prisma.stockMovement.findMany({
        where: { type: 'RECEIPT', occurredAt: { gte: monthStart } },
        select: { kg: true, ratePerKg: true },
      }),
    ]);

    let invoicedThisMonth = 0;
    let outstanding = 0;
    let unpaidInvoices = 0;
    const outstandingByBuyer = new Map<string, number>();
    for (const inv of invoices) {
      const amount = toDecimal(inv.amount);
      const paid = inv.payments.reduce((sum, p) => sum + toDecimal(p.amount), 0);
      const due = Math.max(0, amount - paid);
      if (inv.issuedAt >= monthStart) invoicedThisMonth += amount;
      if (due > 0.005) {
        outstanding += due;
        unpaidInvoices++;
        const buyer = inv.order.buyer.name;
        outstandingByBuyer.set(buyer, (outstandingByBuyer.get(buyer) || 0) + due);
      }
    }

    finance = {
      invoicedThisMonth: round2(invoicedThisMonth),
      collectedThisMonth: round2(toDecimal(paymentsThisMonth._sum.amount)),
      purchasesThisMonth: round2(receiptsThisMonth.reduce((sum, r) => sum + toDecimal(r.kg) * toDecimal(r.ratePerKg), 0)),
      outstanding: round2(outstanding),
      unpaidInvoices,
      topReceivables: Array.from(outstandingByBuyer.entries())
        .map(([buyerName, amount]) => ({ buyerName, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    };
  }

  const activity = await buildActivity(showFinance);

  return {
    generatedAt: now.toISOString(),

    // Legacy flat fields (kept for existing consumers)
    ordersByStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
    machinesRunning,
    machinesIdle,
    machinesBreakdown,
    lowStockYarnCount: lowStock.length,
    rollsAwaitingQc,
    metresTodayProduced: metresToday,

    production: {
      today: metresToday,
      yesterday: trend[TREND_DAYS - 2].total,
      last7Days: sumDays(TREND_DAYS - 7, TREND_DAYS),
      prev7Days: sumDays(0, TREND_DAYS - 7),
      byShiftToday: {
        MORNING: round2(shiftToday.MORNING),
        EVENING: round2(shiftToday.EVENING),
        NIGHT: round2(shiftToday.NIGHT),
      },
      trend,
    },
    machines: {
      total: machines.length,
      running: machinesRunning,
      idle: machinesIdle,
      breakdown: machinesBreakdown,
      utilizationRate: machines.length ? Math.round((machinesRunning / machines.length) * 100) : 0,
      byStage,
      breakdowns,
    },
    orders: {
      total: orders.length,
      active: activeOrders.length,
      activeMetres: round2(activeMetres),
      overdue: overdueOrders,
      dueThisWeek,
      upcoming: activeOrders.slice(0, UPCOMING_LIMIT),
    },
    quality: {
      awaitingRolls: rollsAwaitingQc,
      awaitingMetres: round2(awaitingQcMetres),
      last7Days: {
        inspected,
        pass: qc.pass,
        rework: qc.rework,
        reject: qc.reject,
        passRate: inspected ? round2((qc.pass / inspected) * 100) : null,
      },
      defects: Array.from(defectCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    },
    stock: {
      yarnTypes: yarns.length,
      totalOnHandKg: round3(yarns.reduce((sum, y) => sum + Math.max(0, y.onHandKg), 0)),
      lowStock,
    },
    finishedGoods: {
      readyRolls,
      readyMetres: round2(readyMetres),
    },
    workforce: {
      totalStaff: staffCount,
      markedToday: attendanceToday.length,
      presentToday,
      absentToday: attendanceToday.length - presentToday,
    },
    finance,
    activity,
  };
}

async function buildActivity(includePayments: boolean): Promise<ActivityItem[]> {
  const take = ACTIVITY_LIMIT;
  const [logs, qcRecords, dispatches, receipts, payments] = await Promise.all([
    prisma.productionLog.findMany({
      take,
      orderBy: { loggedAt: 'desc' },
      select: {
        loggedAt: true,
        stage: true,
        shift: true,
        metres: true,
        orderId: true,
        machine: { select: { code: true } },
        order: { select: { orderNo: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.qcRecord.findMany({
      take,
      orderBy: { checkedAt: 'desc' },
      select: {
        checkedAt: true,
        result: true,
        defectType: true,
        roll: { select: { rollNo: true, metres: true } },
        inspector: { select: { name: true } },
      },
    }),
    prisma.dispatch.findMany({
      take,
      orderBy: { dispatchedAt: 'desc' },
      select: {
        dispatchedAt: true,
        dispatchNo: true,
        vehicleNo: true,
        orderId: true,
        order: { select: { orderNo: true, buyer: { select: { name: true } } } },
        items: { select: { metres: true } },
      },
    }),
    prisma.stockMovement.findMany({
      take,
      where: { type: 'RECEIPT' },
      orderBy: { occurredAt: 'desc' },
      select: {
        occurredAt: true,
        kg: true,
        yarnType: { select: { code: true, name: true } },
        supplier: { select: { name: true } },
      },
    }),
    includePayments
      ? prisma.payment.findMany({
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            amount: true,
            method: true,
            invoiceId: true,
            invoice: { select: { invoiceNo: true, order: { select: { buyer: { select: { name: true } } } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const items: ActivityItem[] = [
    ...logs.map((l) => ({
      type: 'PRODUCTION' as const,
      at: l.loggedAt.toISOString(),
      title: `${round2(toDecimal(l.metres)).toLocaleString('en-IN')} m logged on ${l.machine.code}`,
      detail: `${l.order.orderNo} · ${l.stage.toLowerCase()} · ${l.shift.toLowerCase()} shift · ${l.createdBy.name}`,
      tone: 'info' as const,
      href: `/orders/${l.orderId}`,
    })),
    ...qcRecords.map((q) => ({
      type: 'QC' as const,
      at: q.checkedAt.toISOString(),
      title: `Roll ${q.roll.rollNo} ${q.result === 'PASS' ? 'passed QC' : q.result === 'REWORK' ? 'sent for rework' : 'rejected'}`,
      detail: [
        `${round2(toDecimal(q.roll.metres))} m`,
        q.defectType ? q.defectType.replace(/_/g, ' ').toLowerCase() : null,
        q.inspector.name,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: (q.result === 'PASS' ? 'success' : q.result === 'REWORK' ? 'warning' : 'danger') as ActivityItem['tone'],
    })),
    ...dispatches.map((d) => ({
      type: 'DISPATCH' as const,
      at: d.dispatchedAt.toISOString(),
      title: `${d.dispatchNo} dispatched to ${d.order.buyer.name}`,
      detail: [
        d.order.orderNo,
        `${d.items.length} roll${d.items.length === 1 ? '' : 's'}`,
        `${round2(d.items.reduce((s, i) => s + toDecimal(i.metres), 0)).toLocaleString('en-IN')} m`,
        d.vehicleNo,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'success' as const,
      href: `/orders/${d.orderId}`,
    })),
    ...receipts.map((r) => ({
      type: 'RECEIPT' as const,
      at: r.occurredAt.toISOString(),
      title: `${round3(toDecimal(r.kg)).toLocaleString('en-IN')} kg ${r.yarnType.code} received`,
      detail: [r.yarnType.name, r.supplier?.name].filter(Boolean).join(' · '),
      tone: 'neutral' as const,
      href: '/stock',
    })),
    ...payments.map((p) => ({
      type: 'PAYMENT' as const,
      at: p.createdAt.toISOString(),
      title: `Payment of ₹${round2(toDecimal(p.amount)).toLocaleString('en-IN')} received`,
      detail: [p.invoice.invoiceNo, p.invoice.order.buyer.name, p.method].filter(Boolean).join(' · '),
      tone: 'success' as const,
      href: `/invoices/${p.invoiceId}`,
    })),
  ];

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LIMIT);
}
