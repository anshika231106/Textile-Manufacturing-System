import { randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import { salariesForMonth, staffWagesForMonth } from '../src/lib/payroll';

const DEMO_ORDER_COUNT = 45;
const DEMO_ORDER_PREFIX = 'ORD-DEMO-';
const COMPLETED_ORDER_COUNT = 11;
const TARGET_PROFIT = 17_500;
const MIN_DEMO_INVOICED = 132_000;
const DEFAULT_YARN_RATE = 250;
const COMPLETED_ORDER_METRES = 100;
const COMPLETED_ORDER_YARN_KG = 30;
const STAGES = ['SPINNING', 'WEAVING', 'DYEING'] as const;
const SHIFTS = ['MORNING', 'EVENING', 'NIGHT'] as const;

type DemoStatus = 'PENDING' | 'IN_PRODUCTION' | 'QC' | 'READY' | 'COMPLETED';

interface DemoOrderPlan {
  index: number;
  status: DemoStatus;
  metres: number;
  createdAt: Date;
  id: string;
  buyerId: string;
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date.getTime() + hours * 60 * 60 * 1000);
  return result > new Date() ? new Date() : result;
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function sumDecimal(values: Array<{ kg: { toNumber(): number }; ratePerKg: { toNumber(): number } }>): number {
  return values.reduce((sum, value) => sum + value.kg.toNumber() * value.ratePerKg.toNumber(), 0);
}

function maximumSequence(values: string[], prefix: string): number {
  return values.reduce((maximum, value) => {
    const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
}

async function keepCounterAtLeast(key: string, value: number): Promise<void> {
  const counter = await prisma.counter.findUnique({ where: { key } });
  const nextValue = Math.max(counter?.value ?? 0, value);
  await prisma.counter.upsert({
    where: { key },
    update: { value: nextValue },
    create: { key, value: nextValue },
  });
}

async function main(): Promise<void> {
  const demoOrderNumbers = Array.from(
    { length: DEMO_ORDER_COUNT },
    (_, index) => `${DEMO_ORDER_PREFIX}${String(index + 1).padStart(3, '0')}`,
  );
  const existingDemoOrders = await prisma.order.findMany({
    where: { orderNo: { in: demoOrderNumbers } },
    select: { orderNo: true },
  });

  if (existingDemoOrders.length === DEMO_ORDER_COUNT) {
    console.log('The 45 demo orders are already seeded; no changes were made.');
    return;
  }
  if (existingDemoOrders.length > 0) {
    throw new Error(
      `Found ${existingDemoOrders.length} of ${DEMO_ORDER_COUNT} demo orders. ` +
      'Refusing to add a partial duplicate set; inspect the ORD-DEMO-* records first.',
    );
  }

  const [office, supervisor, staffUsers] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'office@everest.com' }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: 'supervisor@everest.com' }, select: { id: true } }),
    prisma.user.findMany({
      where: { role: 'STAFF' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  if (!office || !supervisor || staffUsers.length === 0) {
    throw new Error('Seed the demo users first (office@everest.com, supervisor@everest.com, and Staff accounts are required).');
  }

  const [buyers, supplier, yarnType] = await Promise.all([
    Promise.all(
      Array.from({ length: 5 }, (_, index) => {
        const name = `MillTrace Demo Buyer ${String(index + 1).padStart(2, '0')}`;
        return prisma.buyer.upsert({
          where: { name },
          update: {},
          create: {
            name,
            contactName: `Purchasing Contact ${index + 1}`,
            phone: `90000000${String(index + 1).padStart(2, '0')}`,
          },
          select: { id: true },
        });
      }),
    ),
    prisma.supplier.upsert({
      where: { name: 'Azure Yarns Pvt Ltd' },
      update: {},
      create: { name: 'Azure Yarns Pvt Ltd', phone: '9123456780' },
      select: { id: true },
    }),
    prisma.yarnType.upsert({
      where: { code: 'COT-40-WHT' },
      update: {},
      create: {
        code: 'COT-40-WHT',
        name: 'Cotton 40s',
        colour: 'White',
        countLabel: '40s',
        reorderLevelKg: 100,
      },
      select: { id: true },
    }),
  ]);

  const [spinningMachine, weavingMachine, dyeingMachine] = await Promise.all([
    prisma.machine.upsert({
      where: { code: 'DEMO-SPIN-01' },
      update: {},
      create: {
        code: 'DEMO-SPIN-01',
        name: 'Demo Spinning Unit',
        stage: 'SPINNING',
        status: 'IDLE',
        assignedStaffId: staffUsers[0].id,
        ratePerMetre: 2,
      },
      select: { id: true },
    }),
    prisma.machine.upsert({
      where: { code: 'DEMO-WEAVE-01' },
      update: {},
      create: {
        code: 'DEMO-WEAVE-01',
        name: 'Demo Weaving Loom',
        stage: 'WEAVING',
        status: 'IDLE',
        assignedStaffId: staffUsers[0].id,
        ratePerMetre: 3,
      },
      select: { id: true },
    }),
    prisma.machine.upsert({
      where: { code: 'DEMO-DYE-01' },
      update: {},
      create: {
        code: 'DEMO-DYE-01',
        name: 'Demo Dyeing Vat',
        stage: 'DYEING',
        status: 'IDLE',
        assignedStaffId: staffUsers[0].id,
        ratePerMetre: 1.5,
      },
      select: { id: true },
    }),
  ]);
  const machineByStage = {
    SPINNING: spinningMachine.id,
    WEAVING: weavingMachine.id,
    DYEING: dyeingMachine.id,
  };

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  const month = monthStart.toISOString().slice(0, 7);
  const [monthReceipts, monthInvoices, staffWages, salaries, existingMovements] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { type: 'RECEIPT', occurredAt: { gte: monthStart, lt: monthEnd } },
      select: { kg: true, ratePerKg: true },
    }),
    prisma.invoice.aggregate({
      where: { issuedAt: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
    staffWagesForMonth(month),
    salariesForMonth(month),
    prisma.stockMovement.findMany({
      where: { yarnTypeId: yarnType.id },
      select: { type: true, kg: true },
    }),
  ]);

  // Same payroll the month-end report uses: staff daily wages + monthly salaries.
  const monthlyWages = staffWages.totalWages + salaries.totalSalaries;
  const monthlyPurchases = sumDecimal(monthReceipts);
  const monthlyInvoiced = monthInvoices._sum.amount?.toNumber() ?? 0;
  const currentYarnOnHand = existingMovements.reduce(
    (sum, movement) => sum + (movement.type === 'RECEIPT' ? 1 : -1) * movement.kg.toNumber(),
    0,
  );

  const plans: DemoOrderPlan[] = [];
  const createdAtFor = (index: number) => {
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - (index % 7));
    createdAt.setHours(8 + (index % 8), index % 60, 0, 0);
    return createdAt > now ? new Date(now) : createdAt;
  };
  for (let index = 0; index < DEMO_ORDER_COUNT; index++) {
    const status: DemoStatus =
      index < 6 ? 'PENDING'
        : index < 21 ? 'IN_PRODUCTION'
          : index < 29 ? 'QC'
            : index < 34 ? 'READY'
              : 'COMPLETED';
    const metres = status === 'COMPLETED'
      ? COMPLETED_ORDER_METRES
      : status === 'PENDING'
        ? 150 + (index % 6) * 30
        : 200 + ((index * 43) % 400);
    plans.push({
      index,
      status,
      metres,
      createdAt: createdAtFor(index),
      id: randomUUID(),
      buyerId: buyers[index % buyers.length].id,
    });
  }

  const pendingYarnKg = plans
    .filter((plan) => plan.status === 'PENDING')
    .reduce((sum, plan) => sum + plan.metres * 0.3, 0);
  const totalCompletedIssueKg = COMPLETED_ORDER_COUNT * COMPLETED_ORDER_YARN_KG;
  const restockKg = Math.max(0, totalCompletedIssueKg + pendingYarnKg + 20 - currentYarnOnHand);
  const restockCost = restockKg * DEFAULT_YARN_RATE;
  const targetNewRevenue = Math.max(
    MIN_DEMO_INVOICED,
    Math.ceil(monthlyPurchases + restockCost + monthlyWages + TARGET_PROFIT - monthlyInvoiced),
  );
  const revenuePerCompletedOrder = Math.floor(targetNewRevenue / COMPLETED_ORDER_COUNT);
  const revenueRemainder = targetNewRevenue % COMPLETED_ORDER_COUNT;

  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const requirementRows: Prisma.OrderYarnRequirementCreateManyInput[] = [];
  const jobRows: Prisma.StageJobCreateManyInput[] = [];
  const logRows: Prisma.ProductionLogCreateManyInput[] = [];
  const rollRows: Prisma.RollCreateManyInput[] = [];
  const qcRows: Prisma.QcRecordCreateManyInput[] = [];
  const dispatchRows: Prisma.DispatchCreateManyInput[] = [];
  const dispatchItemRows: Prisma.DispatchItemCreateManyInput[] = [];
  const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const movementRows: Prisma.StockMovementCreateManyInput[] = [];
  let completedOrderIndex = 0;

  for (const plan of plans) {
    const orderNo = `${DEMO_ORDER_PREFIX}${String(plan.index + 1).padStart(3, '0')}`;
    const deadline = new Date(plan.createdAt);
    deadline.setDate(deadline.getDate() + 21 + (plan.index % 10));
    const startedAt = plan.status === 'PENDING' ? null : plan.createdAt;
    const invoiceAmount = plan.status === 'COMPLETED'
      ? revenuePerCompletedOrder + (completedOrderIndex < revenueRemainder ? 1 : 0)
      : 0;
    const ratePerMetre = plan.status === 'COMPLETED'
      ? invoiceAmount / COMPLETED_ORDER_METRES
      : 180 + (plan.index % 6) * 10;

    orderRows.push({
      id: plan.id,
      orderNo,
      buyerId: plan.buyerId,
      fabricType: ['Cotton Twill', 'Poplin', 'Canvas', 'Jersey', 'Denim'][plan.index % 5],
      colour: ['Natural', 'Navy', 'Charcoal', 'Sage', 'Ivory'][plan.index % 5],
      metres: plan.metres,
      ratePerMetre,
      deadline,
      trackingToken: `trk_demo_${randomUUID()}`,
      startedAt,
      createdById: office.id,
      createdAt: plan.createdAt,
    });

    if (plan.status === 'PENDING') {
      requirementRows.push({
        orderId: plan.id,
        yarnTypeId: yarnType.id,
        kgPerMetre: 0.3,
      });
      continue;
    }

    const productionIndex = plan.index - 6;
    const jobCount = plan.status === 'IN_PRODUCTION'
      ? 1 + (productionIndex % 3)
      : STAGES.length;
    const jobsComplete = plan.status !== 'IN_PRODUCTION';

    for (let stageIndex = 0; stageIndex < jobCount; stageIndex++) {
      const stage = STAGES[stageIndex];
      const jobId = randomUUID();
      const jobStartedAt = addHours(plan.createdAt, stageIndex * 2);
      const jobCompleted = jobsComplete || stageIndex < jobCount - 1;
      jobRows.push({
        id: jobId,
        orderId: plan.id,
        stage,
        machineId: machineByStage[stage],
        status: jobCompleted ? 'COMPLETED' : 'RUNNING',
        startedAt: jobStartedAt,
        endedAt: jobCompleted ? addHours(jobStartedAt, 1) : null,
      });
      logRows.push({
        id: randomUUID(),
        stageJobId: jobId,
        orderId: plan.id,
        machineId: machineByStage[stage],
        stage,
        shift: SHIFTS[(plan.index + stageIndex) % SHIFTS.length],
        metres: jobCompleted ? plan.metres : Math.round(plan.metres * 0.45),
        loggedAt: addHours(jobStartedAt, 1),
        createdById: staffUsers[(plan.index + stageIndex) % staffUsers.length].id,
      });
    }

    if (plan.status === 'IN_PRODUCTION') continue;

    let rollStatus: 'PENDING_QC' | 'REWORK' | 'REJECTED' | 'PASSED' | 'DISPATCHED';
    if (plan.status === 'QC') {
      const qcIndex = plan.index - 21;
      rollStatus = qcIndex < 5 ? 'PENDING_QC' : qcIndex < 7 ? 'REWORK' : 'REJECTED';
    } else if (plan.status === 'READY') {
      rollStatus = 'PASSED';
    } else {
      rollStatus = 'DISPATCHED';
    }

    const rollId = randomUUID();
    rollRows.push({
      id: rollId,
      rollNo: `ROLL-DEMO-${String(plan.index + 1).padStart(3, '0')}`,
      orderId: plan.id,
      metres: plan.metres,
      weavingMachineId: machineByStage.WEAVING,
      dyeingMachineId: machineByStage.DYEING,
      status: rollStatus,
      createdById: staffUsers[plan.index % staffUsers.length].id,
      createdAt: addHours(plan.createdAt, 4),
    });

    const qcResult = rollStatus === 'REWORK' ? 'REWORK'
      : rollStatus === 'REJECTED' ? 'REJECT'
        : rollStatus === 'PASSED' || rollStatus === 'DISPATCHED' ? 'PASS'
          : null;
    if (qcResult) {
      qcRows.push({
        id: randomUUID(),
        rollId,
        result: qcResult,
        defectType: qcResult === 'REWORK' ? 'UNEVEN_WEAVE'
          : qcResult === 'REJECT' ? 'COLOUR_MISMATCH'
            : null,
        notes: qcResult === 'REWORK' ? 'Minor weave tension adjustment required'
          : qcResult === 'REJECT' ? 'Colour lot failed shade tolerance'
            : null,
        inspectorId: supervisor.id,
        checkedAt: addHours(plan.createdAt, 5),
      });
    }

    if (plan.status !== 'COMPLETED') continue;

    completedOrderIndex++;
    const dispatchId = randomUUID();
    const dispatchNo = `DSP-DEMO-${String(completedOrderIndex).padStart(3, '0')}`;
    const invoiceNo = `INV-DEMO-${String(completedOrderIndex).padStart(3, '0')}`;
    dispatchRows.push({
      id: dispatchId,
      dispatchNo,
      orderId: plan.id,
      vehicleNo: `MH-12-DEMO-${String(completedOrderIndex).padStart(2, '0')}`,
      dispatchedAt: addHours(plan.createdAt, 6),
      createdById: supervisor.id,
    });
    dispatchItemRows.push({
      id: randomUUID(),
      dispatchId,
      rollId,
      metres: plan.metres,
    });
    invoiceRows.push({
      id: randomUUID(),
      invoiceNo,
      dispatchId,
      orderId: plan.id,
      amount: invoiceAmount,
      issuedAt: now,
    });
    paymentRows.push({
      id: randomUUID(),
      invoiceId: invoiceRows[invoiceRows.length - 1].id!,
      amount: Math.round(invoiceAmount * 0.8 * 100) / 100,
      paidOn: dateOnly(now),
      method: 'Bank Transfer',
      createdById: office.id,
    });
    movementRows.push({
      id: randomUUID(),
      yarnTypeId: yarnType.id,
      type: 'ISSUE',
      kg: COMPLETED_ORDER_YARN_KG,
      ratePerKg: DEFAULT_YARN_RATE,
      orderId: plan.id,
      reference: `ISSUE-${orderNo}`,
      occurredAt: addHours(plan.createdAt, 2),
      createdById: supervisor.id,
    });
  }

  if (restockKg > 0) {
    movementRows.push({
      id: randomUUID(),
      yarnTypeId: yarnType.id,
      type: 'RECEIPT',
      kg: restockKg,
      ratePerKg: DEFAULT_YARN_RATE,
      supplierId: supplier.id,
      reference: 'DEMO-ORDERS-RESTOCK',
      occurredAt: now,
      createdById: supervisor.id,
    });
  }

  await prisma.$transaction([
    prisma.order.createMany({ data: orderRows }),
    prisma.orderYarnRequirement.createMany({ data: requirementRows }),
    prisma.stageJob.createMany({ data: jobRows }),
    prisma.productionLog.createMany({ data: logRows }),
    prisma.roll.createMany({ data: rollRows }),
    prisma.qcRecord.createMany({ data: qcRows }),
    prisma.dispatch.createMany({ data: dispatchRows }),
    prisma.dispatchItem.createMany({ data: dispatchItemRows }),
    prisma.invoice.createMany({ data: invoiceRows }),
    prisma.payment.createMany({ data: paymentRows }),
    prisma.stockMovement.createMany({ data: movementRows }),
    // Machines holding a running job must not be left IDLE, or the board offers them for a new job.
    prisma.machine.updateMany({
      where: { id: { in: jobRows.filter((job) => job.status === 'RUNNING').map((job) => job.machineId) } },
      data: { status: 'RUNNING' },
    }),
  ], { maxWait: 15_000, timeout: 60_000 });

  const orderNumbers = await prisma.order.findMany({
    select: { orderNo: true },
  });
  const dispatchNumbers = await prisma.dispatch.findMany({
    select: { dispatchNo: true },
  });
  const invoiceNumbers = await prisma.invoice.findMany({
    select: { invoiceNo: true },
  });
  await Promise.all([
    keepCounterAtLeast('order', maximumSequence(orderNumbers.map(({ orderNo }) => orderNo), 'ORD-')),
    keepCounterAtLeast('dispatch', maximumSequence(dispatchNumbers.map(({ dispatchNo }) => dispatchNo), 'DSP-')),
    keepCounterAtLeast('invoice', maximumSequence(invoiceNumbers.map(({ invoiceNo }) => invoiceNo), 'INV-')),
  ]);

  const expectedProfit = monthlyInvoiced + targetNewRevenue - monthlyPurchases - restockCost - monthlyWages;
  console.log(
    `Seeded ${DEMO_ORDER_COUNT} demo orders (11 completed) across the last 7 days. ` +
    `Projected current-month operating profit: ₹${expectedProfit.toLocaleString('en-IN')}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
