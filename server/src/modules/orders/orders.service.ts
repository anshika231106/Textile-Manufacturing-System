import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { round2, round3, toDecimal } from '../../lib/numbers';
import { deriveOrderStatus } from '../../domain/orderStatus';
import { evaluateFeasibility } from '../../domain/feasibility';
import { notFound, conflict, unprocessable } from '../../lib/httpErrors';
import type { FeasibilityInput, CreateOrderInput, ListOrdersQuery } from './orders.schemas';

export class OrdersService {
  /**
   * Helper: Calculate real-time stock balances per yarn type.
   */
  private async getStockMap(yarnTypeIds: string[]) {
    const [allMovements, unstartedOrders] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { yarnTypeId: { in: yarnTypeIds } },
        select: { yarnTypeId: true, type: true, kg: true, ratePerKg: true },
      }),
      prisma.order.findMany({
        where: { stageJobs: { none: {} } },
        select: {
          id: true,
          metres: true,
          requirements: {
            where: { yarnTypeId: { in: yarnTypeIds } },
            select: { yarnTypeId: true, kgPerMetre: true },
          },
        },
      }),
    ]);

    const onHandMap = new Map<string, number>();
    const movementCosts = new Map<string, { totalCost: number; totalKg: number }>();

    for (const m of allMovements) {
      const qty = toDecimal(m.kg);
      const current = onHandMap.get(m.yarnTypeId) || 0;
      if (m.type === 'RECEIPT') {
        onHandMap.set(m.yarnTypeId, current + qty);

        const currentCost = movementCosts.get(m.yarnTypeId) || { totalCost: 0, totalKg: 0 };
        currentCost.totalCost += qty * toDecimal(m.ratePerKg);
        currentCost.totalKg += qty;
        movementCosts.set(m.yarnTypeId, currentCost);
      } else if (m.type === 'ISSUE') {
        onHandMap.set(m.yarnTypeId, current - qty);
      }
    }

    const reservedMap = new Map<string, number>();
    for (const order of unstartedOrders) {
      const orderMetres = toDecimal(order.metres);
      for (const req of order.requirements) {
        const requiredKg = toDecimal(req.kgPerMetre) * orderMetres;
        const current = reservedMap.get(req.yarnTypeId) || 0;
        reservedMap.set(req.yarnTypeId, current + requiredKg);
      }
    }

    const stockMap = new Map<string, { onHandKg: number; reservedByOthersKg: number; availableKg: number; avgRate: number }>();
    for (const id of yarnTypeIds) {
      const onHandKg = round3(onHandMap.get(id) || 0);
      const reservedByOthersKg = round3(reservedMap.get(id) || 0);
      const availableKg = round3(Math.max(onHandKg - reservedByOthersKg, 0));
      const costInfo = movementCosts.get(id);
      const avgRate = costInfo && costInfo.totalKg > 0 ? round2(costInfo.totalCost / costInfo.totalKg) : 250;

      stockMap.set(id, {
        onHandKg,
        reservedByOthersKg,
        availableKg,
        avgRate,
      });
    }

    return stockMap;
  }

  /**
   * Helper: Formats order entity into standardized detail matching MVP §8.12 and frontend contract.
   */
  private formatOrderDetail(order: any, feasibility: any = null) {
    const metres = Number(order.metres);
    const ratePerMetre = Number(order.ratePerMetre);
    const totalAmount = round2(metres * ratePerMetre);

    // Roll statistics
    const rollsList = order.rolls || [];
    let pendingQc = 0;
    let rework = 0;
    let passed = 0;
    let rejected = 0;
    let dispatched = 0;
    let passedMetres = 0;
    let dispatchedMetres = 0;

    const formattedRolls = rollsList.map((r: any) => {
      const m = Number(r.metres);
      let qcStatus: 'PENDING' | 'PASS' | 'REWORK' | 'REJECT' = 'PENDING';

      if (r.status === 'PENDING_QC') {
        pendingQc++;
      } else if (r.status === 'REWORK') {
        rework++;
        qcStatus = 'REWORK';
      } else if (r.status === 'PASSED') {
        passed++;
        passedMetres += m;
        qcStatus = 'PASS';
      } else if (r.status === 'REJECTED') {
        rejected++;
        qcStatus = 'REJECT';
      } else if (r.status === 'DISPATCHED') {
        dispatched++;
        dispatchedMetres += m;
        qcStatus = 'PASS';
      }

      return {
        id: r.id,
        rollNumber: r.rollNo,
        metres: m,
        qcStatus,
        createdAt: r.createdAt?.toISOString(),
      };
    });

    const rollCounts = {
      total: rollsList.length,
      pendingQc,
      rework,
      passed,
      rejected,
      dispatched,
      passedMetres: round2(passedMetres),
      dispatchedMetres: round2(dispatchedMetres),
    };

    // Dynamic order status derivation
    const statusCtx = {
      startedAt: order.startedAt,
      hasJobs: (order.stageJobs || []).length > 0,
      rolls: rollCounts,
    };
    const derived = deriveOrderStatus(statusCtx);

    // Current stage
    let currentStage: string | null = null;
    if (order.stageJobs && order.stageJobs.length > 0) {
      const latestJob = order.stageJobs[order.stageJobs.length - 1];
      currentStage = latestJob.stage;
    } else if (order.startedAt) {
      currentStage = 'SPINNING';
    }

    // Requirements formatting
    const requirements = (order.requirements || []).map((req: any) => {
      const kgPerMetre = Number(req.kgPerMetre);
      const requiredKg = round3(kgPerMetre * metres);
      return {
        yarnTypeId: req.yarnTypeId,
        code: req.yarnType?.code || req.yarnTypeId,
        name: req.yarnType?.name || 'Yarn',
        colour: req.yarnType?.colour || '',
        kgPerMetre,
        requiredKg,
        yarnTypeName: req.yarnType?.name || 'Yarn',
        yarnTypeCode: req.yarnType?.code || req.yarnTypeId,
        availableKg: requiredKg,
        shortfallKg: 0,
        isSufficient: true,
      };
    });

    // Stage progress
    const stagesDef = ['SPINNING', 'WEAVING', 'DYEING'] as const;
    const stageProgress = stagesDef.map((stg) => {
      const job = (order.stageJobs || []).find((j: any) => j.stage === stg);
      let status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' = 'PENDING';
      let producedMetres = 0;

      if (job) {
        if (job.status === 'COMPLETED') status = 'COMPLETED';
        else if (job.status === 'RUNNING') status = 'IN_PROGRESS';

        for (const log of job.logs || []) {
          producedMetres += Number(log.metres);
        }
      }

      return {
        stage: stg,
        machineId: job?.machineId || undefined,
        machineName: job?.machine?.name || undefined,
        status,
        producedMetres: round2(producedMetres),
        targetMetres: metres,
      };
    });

    return {
      id: order.id,
      orderNo: order.orderNo,
      orderNumber: order.orderNo,
      buyerId: order.buyerId,
      buyer: {
        id: order.buyer?.id || order.buyerId,
        name: order.buyer?.name || '',
      },
      buyerName: order.buyer?.name || '',
      buyerPhone: order.buyer?.phone || undefined,
      fabricType: order.fabricType,
      colour: order.colour,
      metres,
      ratePerMetre,
      totalAmount,
      deadline: order.deadline instanceof Date ? order.deadline.toISOString().split('T')[0] : String(order.deadline),
      trackingToken: order.trackingToken,
      trackingPath: `/track/${order.trackingToken}`,
      startedAt: order.startedAt ? order.startedAt.toISOString() : null,
      status: derived.clientStatus,
      canonicalStatus: derived.canonicalStatus,
      currentStage: currentStage || 'SPINNING',
      requirements,
      yarnRequirements: requirements,
      stages: stageProgress,
      stageProgress,
      rolls: rollCounts,
      rollSummary: {
        totalRolls: rollsList.length,
        passedRolls: passed,
        inQcRolls: pendingQc,
        reworkRolls: rework,
        rejectedRolls: rejected,
        rolls: formattedRolls,
      },
      feasibility: order.startedAt ? null : feasibility,
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    };
  }

  /**
   * API-18: POST /orders/feasibility - Preview yarn feasibility without saving.
   */
  async previewFeasibility(input: FeasibilityInput) {
    const rawReqs: { yarnTypeId: string; requiredKg: number }[] = [];

    if (input.lines && input.metres) {
      for (const line of input.lines) {
        rawReqs.push({
          yarnTypeId: line.yarnTypeId,
          requiredKg: round3(line.kgPerMetre * input.metres),
        });
      }
    } else if (input.yarnRequirements) {
      for (const r of input.yarnRequirements) {
        rawReqs.push({
          yarnTypeId: r.yarnTypeId,
          requiredKg: round3(r.requiredKg),
        });
      }
    }

    const yarnTypeIds = rawReqs.map((r) => r.yarnTypeId);
    const yarnTypes = await prisma.yarnType.findMany({
      where: { id: { in: yarnTypeIds } },
    });

    if (yarnTypes.length !== yarnTypeIds.length) {
      const foundIds = new Set(yarnTypes.map((y) => y.id));
      const missing = yarnTypeIds.find((id) => !foundIds.has(id));
      throw notFound(`Yarn type '${missing}' not found`);
    }

    const stockMap = await this.getStockMap(yarnTypeIds);
    const assessment = evaluateFeasibility(rawReqs, stockMap);

    const enrichedLines = assessment.lines.map((l) => {
      const yt = yarnTypes.find((y) => y.id === l.yarnTypeId);
      return {
        yarnTypeId: l.yarnTypeId,
        code: yt?.code || '',
        name: yt?.name || '',
        yarnTypeCode: yt?.code || '',
        yarnTypeName: yt?.name || '',
        requiredKg: l.requiredKg,
        onHandKg: l.onHandKg,
        reservedByOthersKg: l.reservedByOthersKg,
        availableKg: l.availableKg,
        shortfallKg: l.shortfallKg,
        isSufficient: l.isSufficient,
      };
    });

    return {
      canStart: assessment.canStart,
      isFeasible: assessment.isFeasible,
      lines: enrichedLines,
      items: enrichedLines,
    };
  }

  /**
   * API-19: POST /orders - Create order with sequential numbering and tracking token.
   */
  async createOrder(input: CreateOrderInput, userId: string) {
    const buyer = await prisma.buyer.findUnique({ where: { id: input.buyerId } });
    if (!buyer) {
      throw notFound(`Buyer '${input.buyerId}' not found`);
    }

    // Determine requirements normalized to kgPerMetre
    const requirements: { yarnTypeId: string; kgPerMetre: number }[] = [];
    if (input.lines) {
      for (const line of input.lines) {
        requirements.push({
          yarnTypeId: line.yarnTypeId,
          kgPerMetre: round3(line.kgPerMetre),
        });
      }
    } else if (input.yarnRequirements) {
      for (const req of input.yarnRequirements) {
        requirements.push({
          yarnTypeId: req.yarnTypeId,
          kgPerMetre: round3(req.requiredKg / input.metres),
        });
      }
    }

    const yarnTypeIds = requirements.map((r) => r.yarnTypeId);
    const yarnTypes = await prisma.yarnType.findMany({
      where: { id: { in: yarnTypeIds } },
    });
    if (yarnTypes.length !== yarnTypeIds.length) {
      const foundIds = new Set(yarnTypes.map((y) => y.id));
      const missing = yarnTypeIds.find((id) => !foundIds.has(id));
      throw notFound(`Yarn type '${missing}' not found`);
    }

    // Atomic creation inside transaction
    const newOrder = await prisma.$transaction(
      async (tx) => {
        const counter = await tx.counter.upsert({
          where: { key: 'order' },
          update: { value: { increment: 1 } },
          create: { key: 'order', value: 1 },
        });

        const orderNo = `ORD-${String(counter.value).padStart(4, '0')}`;
        const trackingToken = crypto.randomBytes(18).toString('base64url');

        return await tx.order.create({
          data: {
            orderNo,
            buyerId: input.buyerId,
            fabricType: input.fabricType,
            colour: input.colour,
            metres: input.metres,
            ratePerMetre: input.ratePerMetre,
            deadline: new Date(input.deadline),
            trackingToken,
            createdById: userId,
            requirements: {
              create: requirements.map((r) => ({
                yarnTypeId: r.yarnTypeId,
                kgPerMetre: r.kgPerMetre,
              })),
            },
          },
          include: {
            buyer: true,
            requirements: { include: { yarnType: true } },
            stageJobs: { include: { machine: true, logs: true } },
            rolls: true,
          },
        });
      },
      { maxWait: 10000, timeout: 20000 }
    );

    // Feasibility evaluation for created order
    const feasibility = await this.previewFeasibility({
      metres: input.metres,
      lines: requirements,
    });

    return this.formatOrderDetail(newOrder, feasibility);
  }

  /**
   * API-20: GET /orders - List orders with dynamic status derivation.
   */
  async listOrders(query: ListOrdersQuery) {
    const where: any = {};
    if (query.buyerId) {
      where.buyerId = query.buyerId;
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: {
          buyer: true,
          requirements: { include: { yarnType: true } },
          stageJobs: { include: { machine: true, logs: true } },
          rolls: true,
        },
      }),
    ]);

    let formattedList = orders.map((o) => this.formatOrderDetail(o));

    if (query.status) {
      const allowed = query.status.split(',').map((s) => s.trim().toUpperCase());
      formattedList = formattedList.filter(
        (o) => allowed.includes(o.status) || allowed.includes(o.canonicalStatus)
      );
    }

    return {
      items: formattedList,
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  /**
   * API-21: GET /orders/:id - Order detail.
   */
  async getOrder(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        buyer: true,
        requirements: { include: { yarnType: true } },
        stageJobs: { include: { machine: true, logs: true } },
        rolls: true,
      },
    });

    if (!order) {
      throw notFound(`Order '${id}' not found`);
    }

    let feasibility: any = null;
    if (!order.startedAt) {
      feasibility = await this.previewFeasibility({
        metres: Number(order.metres),
        lines: order.requirements.map((r) => ({
          yarnTypeId: r.yarnTypeId,
          kgPerMetre: Number(r.kgPerMetre),
        })),
      });
    }

    return this.formatOrderDetail(order, feasibility);
  }

  /**
   * API-22: POST /orders/:id/start - Start production and issue yarn.
   */
  async startProduction(id: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        requirements: { include: { yarnType: true } },
        stageJobs: true,
      },
    });

    if (!order) {
      throw notFound(`Order '${id}' not found`);
    }

    if (order.startedAt || order.stageJobs.length > 0) {
      throw conflict('ALREADY_STARTED', 'Order has already started production');
    }

    // Check stock feasibility
    const yarnTypeIds = order.requirements.map((r) => r.yarnTypeId);
    const stockMap = await this.getStockMap(yarnTypeIds);

    const shortages: any[] = [];
    for (const req of order.requirements) {
      const neededKg = round3(Number(req.kgPerMetre) * Number(order.metres));
      const stock = stockMap.get(req.yarnTypeId);
      const onHand = stock?.onHandKg || 0;
      if (neededKg > onHand) {
        shortages.push({
          yarnCode: req.yarnType.code,
          requiredKg: neededKg,
          availableKg: onHand,
          shortfallKg: round3(neededKg - onHand),
        });
      }
    }

    if (shortages.length > 0) {
      throw unprocessable('INSUFFICIENT_YARN', 'Not enough yarn to start this order.', shortages);
    }

    // Start production atomically inside transaction
    const updatedOrder = await prisma.$transaction(
      async (tx) => {
        // 1. Record yarn ISSUE movements with weighted average rate
        for (const req of order.requirements) {
          const neededKg = round3(Number(req.kgPerMetre) * Number(order.metres));
          const stock = stockMap.get(req.yarnTypeId);
          const ratePerKg = stock?.avgRate || 250;

          await tx.stockMovement.create({
            data: {
              yarnTypeId: req.yarnTypeId,
              type: 'ISSUE',
              orderId: order.id,
              kg: neededKg,
              ratePerKg,
              reference: `ISSUE-${order.orderNo}`,
              createdById: userId,
            },
          });
        }

        // 2. Assign initial spinning machine if available
        const spinningMachine = await tx.machine.findFirst({
          where: { stage: 'SPINNING', status: 'IDLE' },
        });

        if (spinningMachine) {
          await tx.stageJob.create({
            data: {
              orderId: order.id,
              stage: 'SPINNING',
              machineId: spinningMachine.id,
              status: 'RUNNING',
            },
          });
          await tx.machine.update({
            where: { id: spinningMachine.id },
            data: { status: 'RUNNING' },
          });
        }

        // 3. Mark startedAt on order
        return await tx.order.update({
          where: { id: order.id },
          data: { startedAt: new Date() },
          include: {
            buyer: true,
            requirements: { include: { yarnType: true } },
            stageJobs: { include: { machine: true, logs: true } },
            rolls: true,
          },
        });
      },
      { maxWait: 10000, timeout: 20000 }
    );

    return this.formatOrderDetail(updatedOrder, null);
  }
}

export const ordersService = new OrdersService();
