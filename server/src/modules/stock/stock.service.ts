import { prisma } from '../../lib/prisma';
import { round2, round3, toDecimal } from '../../lib/numbers';
import { computeYarnStock } from '../../domain/stock';
import { notFound } from '../../lib/httpErrors';
import type { CreateReceiptInput, StockLedgerQuery, FinishedStockQuery } from './stock.schemas';

export class StockService {
  /**
   * API-14: Record a raw material yarn receipt movement.
   */
  async recordReceipt(input: CreateReceiptInput, userId: string) {
    // 1. Verify foreign key relations
    const [yarnType, supplier] = await Promise.all([
      prisma.yarnType.findUnique({ where: { id: input.yarnTypeId } }),
      prisma.supplier.findUnique({ where: { id: input.supplierId } }),
    ]);

    if (!yarnType) {
      throw notFound(`Yarn type '${input.yarnTypeId}' not found`);
    }
    if (!supplier) {
      throw notFound(`Supplier '${input.supplierId}' not found`);
    }

    if (input.orderId) {
      const order = await prisma.order.findUnique({ where: { id: input.orderId } });
      if (!order) {
        throw notFound(`Order '${input.orderId}' not found`);
      }
    }

    // 2. Create stock movement and compute new on-hand balance inside transaction
    const { movement, onHandKg } = await prisma.$transaction(
      async (tx) => {
        const mov = await tx.stockMovement.create({
          data: {
            yarnTypeId: input.yarnTypeId,
            supplierId: input.supplierId,
            orderId: input.orderId || null,
            type: 'RECEIPT',
            kg: input.kg,
            ratePerKg: input.ratePerKg,
            reference: input.reference || null,
            createdById: userId,
          },
        });

        const movements = await tx.stockMovement.findMany({
          where: { yarnTypeId: input.yarnTypeId },
          select: { type: true, kg: true },
        });

        let balance = 0;
        for (const m of movements) {
          const qty = toDecimal(m.kg);
          if (m.type === 'RECEIPT') balance += qty;
          else if (m.type === 'ISSUE') balance -= qty;
        }

        return { movement: mov, onHandKg: round3(balance) };
      },
      { maxWait: 10000, timeout: 20000 }
    );

    return {
      movement: {
        id: movement.id,
        occurredAt: movement.occurredAt.toISOString(),
        type: movement.type,
        yarnTypeId: yarnType.id,
        yarnCode: yarnType.code,
        yarnName: yarnType.name,
        kg: Number(movement.kg),
        ratePerKg: Number(movement.ratePerKg),
        supplierName: supplier.name,
        reference: movement.reference || undefined,
      },
      onHandKg,
    };
  }

  /**
   * API-15: Stock summary per yarn type across on-hand, unstarted order reservations, and alerts.
   */
  async getStockSummary() {
    const [yarnTypes, allMovements, unstartedOrders] = await Promise.all([
      prisma.yarnType.findMany({ orderBy: { code: 'asc' } }),
      prisma.stockMovement.findMany({ select: { yarnTypeId: true, type: true, kg: true } }),
      prisma.order.findMany({
        where: { stageJobs: { none: {} } },
        select: {
          metres: true,
          requirements: { select: { yarnTypeId: true, kgPerMetre: true } },
        },
      }),
    ]);

    // Aggregate on-hand per yarn type: receipts - issues
    const onHandMap = new Map<string, number>();
    for (const m of allMovements) {
      const current = onHandMap.get(m.yarnTypeId) || 0;
      const qty = toDecimal(m.kg);
      if (m.type === 'RECEIPT') {
        onHandMap.set(m.yarnTypeId, current + qty);
      } else if (m.type === 'ISSUE') {
        onHandMap.set(m.yarnTypeId, current - qty);
      }
    }

    // Aggregate reserved yarn for unstarted orders
    const reservedMap = new Map<string, number>();
    for (const order of unstartedOrders) {
      const orderMetres = toDecimal(order.metres);
      for (const req of order.requirements) {
        const requiredKg = toDecimal(req.kgPerMetre) * orderMetres;
        const current = reservedMap.get(req.yarnTypeId) || 0;
        reservedMap.set(req.yarnTypeId, current + requiredKg);
      }
    }

    return yarnTypes.map((yt) => {
      const onHandKg = round3(onHandMap.get(yt.id) || 0);
      const reservedKg = round3(reservedMap.get(yt.id) || 0);
      const reorderLevelKg = Number(yt.reorderLevelKg);

      const computed = computeYarnStock({
        onHandKg,
        reservedKg,
        reorderLevelKg,
      });

      return {
        yarnTypeId: yt.id,
        code: yt.code,
        name: yt.name,
        colour: yt.colour,
        countLabel: yt.countLabel || undefined,
        onHandKg,
        reservedKg,
        availableKg: computed.availableKg,
        shortfallKg: computed.shortfallKg,
        reorderLevelKg,
        isLow: computed.isLow,
      };
    });
  }

  /**
   * API-16: Yarn ledger audit movements newest first with pagination.
   */
  async getStockLedger(query: StockLedgerQuery) {
    const where: any = {};
    if (query.yarnTypeId && query.yarnTypeId !== 'ALL') {
      where.yarnTypeId = query.yarnTypeId;
    }

    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
        include: {
          yarnType: { select: { code: true, name: true } },
          supplier: { select: { name: true } },
          order: { select: { orderNo: true } },
        },
      }),
    ]);

    const items = movements.map((m) => ({
      id: m.id,
      occurredAt: m.occurredAt.toISOString(),
      type: m.type,
      yarnTypeId: m.yarnTypeId,
      yarnCode: m.yarnType.code,
      yarnName: m.yarnType.name,
      kg: Number(m.kg),
      ratePerKg: Number(m.ratePerKg),
      supplierName: m.supplier?.name || undefined,
      orderNo: m.order?.orderNo || undefined,
      reference: m.reference || undefined,
    }));

    return {
      items,
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  /**
   * API-17: Finished fabric on shelf vs dispatched.
   */
  async getFinishedStock(query: FinishedStockQuery) {
    const where: any = {};
    if (query.orderId) {
      where.id = query.orderId;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { orderNo: 'asc' },
      select: {
        id: true,
        orderNo: true,
        buyer: { select: { name: true } },
        rolls: {
          select: {
            status: true,
            metres: true,
          },
        },
      },
    });

    return orders.map((o) => {
      let pendingQcMetres = 0;
      let passedOnShelfMetres = 0;
      let dispatchedMetres = 0;

      for (const roll of o.rolls) {
        const m = toDecimal(roll.metres);
        if (roll.status === 'PENDING_QC' || roll.status === 'REWORK') {
          pendingQcMetres += m;
        } else if (roll.status === 'PASSED') {
          passedOnShelfMetres += m;
        } else if (roll.status === 'DISPATCHED') {
          dispatchedMetres += m;
        }
      }

      return {
        orderId: o.id,
        orderNo: o.orderNo,
        buyerName: o.buyer.name,
        pendingQcMetres: round2(pendingQcMetres),
        passedOnShelfMetres: round2(passedOnShelfMetres),
        dispatchedMetres: round2(dispatchedMetres),
      };
    });
  }
}

export const stockService = new StockService();
