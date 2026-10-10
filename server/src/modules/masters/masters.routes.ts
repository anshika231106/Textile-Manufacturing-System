import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ok } from '../../lib/respond';
import { authenticate } from '../../middleware/authenticate';

import { stockService } from '../stock/stock.service';

export const mastersRoutes = Router();

mastersRoutes.use(authenticate);

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
      where: { role: 'STAFF' },
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
