import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ok } from '../../lib/respond';
import { conflict, notFound } from '../../lib/httpErrors';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';

import { stockService } from '../stock/stock.service';

export const mastersRoutes = Router();

mastersRoutes.use(authenticate);

// Deleting master data is limited to the roles that manage it.
const MASTER_ADMIN_ROLES = ['OWNER', 'OFFICE'] as const;
const idParams = validate({ params: z.object({ id: z.string().uuid('Invalid ID format') }) });

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// API-04: GET /buyers
mastersRoutes.get(['/buyers', '/masters/buyers'], async (_req, res, next) => {
  try {
    const buyers = await prisma.buyer.findMany({
      orderBy: { name: 'asc' },
    });
    return ok(res, buyers);
  } catch (err) {
    next(err);
  }
});

// API-06: GET /suppliers
mastersRoutes.get(['/suppliers', '/masters/suppliers'], async (_req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
    return ok(res, suppliers);
  } catch (err) {
    next(err);
  }
});

// API-08: GET /yarn-types
mastersRoutes.get(['/yarn-types', '/masters/yarn-types'], async (_req, res, next) => {
  try {
    const [yarnTypes, stockSummary] = await Promise.all([
      prisma.yarnType.findMany({ orderBy: { code: 'asc' } }),
      stockService.getStockSummary().catch(() => []),
    ]);

    const stockMap = new Map((stockSummary || []).map((s) => [s.yarnTypeId, s]));

    return ok(
      res,
      yarnTypes.map((yt) => {
        const stock = stockMap.get(yt.id);
        return {
          id: yt.id,
          code: yt.code,
          name: yt.name,
          colour: yt.colour,
          countLabel: yt.countLabel,
          reorderLevelKg: Number(yt.reorderLevelKg),
          onHandKg: stock?.onHandKg ?? 0,
          availableKg: stock?.availableKg ?? 0,
          reservedKg: stock?.reservedKg ?? 0,
          shortfallKg: stock?.shortfallKg ?? 0,
          isLow: stock?.isLow ?? false,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

// API-10: GET /machines
mastersRoutes.get(['/machines', '/masters/machines'], async (_req, res, next) => {
  try {
    const machines = await prisma.machine.findMany({
      orderBy: { code: 'asc' },
    });
    return ok(
      res,
      machines.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        stage: m.stage,
        status: m.status,
        ratePerMetre: Number(m.ratePerMetre),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// API-12: GET /workers
mastersRoutes.get(['/workers', '/masters/workers'], async (_req, res, next) => {
  try {
    const workers = await prisma.user.findMany({
      where: { role: 'STAFF', deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return ok(
      res,
      workers.map((w, idx) => ({
        id: w.id,
        code: `WRK-${String(idx + 1).padStart(3, '0')}`,
        name: w.name,
        dailyWage: w.dailyWage ? Number(w.dailyWage) : 550,
        active: true,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// DELETE /buyers/:id - blocked while any order references the buyer
mastersRoutes.delete(
  ['/buyers/:id', '/masters/buyers/:id'],
  authorize(...MASTER_ADMIN_ROLES),
  idParams,
  async (req, res, next) => {
    try {
      const buyer = await prisma.buyer.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { orders: true } } },
      });
      if (!buyer) throw notFound('Buyer not found');
      if (buyer._count.orders > 0) {
        throw conflict(
          'MASTER_IN_USE',
          `Cannot delete "${buyer.name}": it is used by ${plural(buyer._count.orders, 'order')}.`
        );
      }
      await prisma.buyer.delete({ where: { id: buyer.id } });
      return ok(res, { id: buyer.id });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /suppliers/:id - blocked while any stock movement references the supplier
mastersRoutes.delete(
  ['/suppliers/:id', '/masters/suppliers/:id'],
  authorize(...MASTER_ADMIN_ROLES),
  idParams,
  async (req, res, next) => {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { movements: true } } },
      });
      if (!supplier) throw notFound('Supplier not found');
      if (supplier._count.movements > 0) {
        throw conflict(
          'MASTER_IN_USE',
          `Cannot delete "${supplier.name}": it is used by ${plural(supplier._count.movements, 'stock movement')}.`
        );
      }
      await prisma.supplier.delete({ where: { id: supplier.id } });
      return ok(res, { id: supplier.id });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /yarn-types/:id - blocked while stock movements or order requirements reference it
mastersRoutes.delete(
  ['/yarn-types/:id', '/masters/yarn-types/:id'],
  authorize(...MASTER_ADMIN_ROLES),
  idParams,
  async (req, res, next) => {
    try {
      const yarnType = await prisma.yarnType.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { movements: true, requirements: true } } },
      });
      if (!yarnType) throw notFound('Yarn type not found');
      const { movements, requirements } = yarnType._count;
      if (movements > 0 || requirements > 0) {
        const uses = [
          movements > 0 && plural(movements, 'stock movement'),
          requirements > 0 && plural(requirements, 'order requirement'),
        ].filter(Boolean);
        throw conflict(
          'MASTER_IN_USE',
          `Cannot delete "${yarnType.code}": it is used by ${uses.join(' and ')}.`
        );
      }
      await prisma.yarnType.delete({ where: { id: yarnType.id } });
      return ok(res, { id: yarnType.id });
    } catch (err) {
      next(err);
    }
  }
);
