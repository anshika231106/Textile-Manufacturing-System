import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { created, ok } from '../../lib/respond';
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

// Friendly 409 for a duplicate unique field; the P2002 handler still covers races.
async function ensureUnique(existing: Promise<unknown>, message: string) {
  if (await existing) throw conflict('MASTER_DUPLICATE', message);
}

// Optional text field: a blank string is stored as null, so edits can clear a value.
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional()
  );
const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().email('Invalid email').nullable().optional()
);

const createBuyerBody = z.object({
  name: z.string().trim().min(1, 'Buyer name is required').max(200),
  contactName: optionalText(200),
  phone: optionalText(30),
  email: optionalEmail,
  address: optionalText(500),
});
const updateBuyerBody = createBuyerBody.partial();

const createSupplierBody = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200),
  contactName: optionalText(200),
  phone: optionalText(30),
  email: optionalEmail,
});
const updateSupplierBody = createSupplierBody.partial();

const createYarnTypeBody = z.object({
  code: z.string().trim().min(1, 'Yarn code is required').max(50).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, 'Yarn name is required').max(200),
  colour: z.string().trim().min(1, 'Yarn colour is required').max(100),
  countLabel: optionalText(50),
  reorderLevelKg: z.coerce.number().min(0, 'Reorder level cannot be negative'),
});
const updateYarnTypeBody = createYarnTypeBody.partial();

const createMachineBody = z.object({
  code: z.string().trim().min(1, 'Machine code is required').max(50).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, 'Machine name is required').max(200),
  stage: z.enum(['SPINNING', 'WEAVING', 'DYEING']),
  status: z.enum(['IDLE', 'RUNNING', 'BREAKDOWN']).optional(),
  ratePerMetre: z.coerce.number().min(0, 'Rate cannot be negative'),
});
// Stage is fixed once production history may exist, and status is owned by the floor module.
const updateMachineBody = createMachineBody.omit({ stage: true, status: true }).partial();

type YarnTypeRow = Awaited<ReturnType<typeof prisma.yarnType.create>>;
type MachineRow = Awaited<ReturnType<typeof prisma.machine.create>>;
type StockRow = Awaited<ReturnType<typeof stockService.getStockSummary>>[number];

function toYarnTypeDto(yt: YarnTypeRow, stock?: StockRow) {
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
}

function toMachineDto(m: MachineRow) {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    stage: m.stage,
    status: m.status,
    ratePerMetre: Number(m.ratePerMetre),
  };
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
      yarnTypes.map((yt) => toYarnTypeDto(yt, stockMap.get(yt.id)))
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
    return ok(res, machines.map(toMachineDto));
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

// POST /buyers
mastersRoutes.post(
  ['/buyers', '/masters/buyers'],
  authorize(...MASTER_ADMIN_ROLES),
  validate({ body: createBuyerBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createBuyerBody>;
      await ensureUnique(
        prisma.buyer.findUnique({ where: { name: body.name } }),
        `Buyer "${body.name}" already exists.`
      );
      const buyer = await prisma.buyer.create({ data: body });
      return created(res, buyer);
    } catch (err) {
      next(err);
    }
  }
);

// POST /suppliers - supervisors receive yarn deliveries, so they may add suppliers too
mastersRoutes.post(
  ['/suppliers', '/masters/suppliers'],
  authorize(...MASTER_ADMIN_ROLES, 'SUPERVISOR'),
  validate({ body: createSupplierBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createSupplierBody>;
      await ensureUnique(
        prisma.supplier.findUnique({ where: { name: body.name } }),
        `Supplier "${body.name}" already exists.`
      );
      const supplier = await prisma.supplier.create({ data: body });
      return created(res, supplier);
    } catch (err) {
      next(err);
    }
  }
);

// POST /yarn-types
mastersRoutes.post(
  ['/yarn-types', '/masters/yarn-types'],
  authorize(...MASTER_ADMIN_ROLES),
  validate({ body: createYarnTypeBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createYarnTypeBody>;
      await ensureUnique(
        prisma.yarnType.findUnique({ where: { code: body.code } }),
        `Yarn type "${body.code}" already exists.`
      );
      const yt = await prisma.yarnType.create({ data: body });
      return created(res, toYarnTypeDto(yt));
    } catch (err) {
      next(err);
    }
  }
);

// POST /machines
mastersRoutes.post(
  ['/machines', '/masters/machines'],
  authorize(...MASTER_ADMIN_ROLES),
  validate({ body: createMachineBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createMachineBody>;
      await ensureUnique(
        prisma.machine.findUnique({ where: { code: body.code } }),
        `Machine "${body.code}" already exists.`
      );
      const m = await prisma.machine.create({ data: body });
      return created(res, toMachineDto(m));
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /buyers/:id
mastersRoutes.patch(
  ['/buyers/:id', '/masters/buyers/:id'],
  authorize(...MASTER_ADMIN_ROLES),
  idParams,
  validate({ body: updateBuyerBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateBuyerBody>;
      if (!(await prisma.buyer.findUnique({ where: { id: req.params.id } }))) throw notFound('Buyer not found');
      if (body.name) {
        await ensureUnique(
          prisma.buyer.findFirst({ where: { name: body.name, NOT: { id: req.params.id } } }),
          `Buyer "${body.name}" already exists.`
        );
      }
      const buyer = await prisma.buyer.update({ where: { id: req.params.id }, data: body });
      return ok(res, buyer);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /suppliers/:id
mastersRoutes.patch(
  ['/suppliers/:id', '/masters/suppliers/:id'],
  authorize(...MASTER_ADMIN_ROLES, 'SUPERVISOR'),
  idParams,
  validate({ body: updateSupplierBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateSupplierBody>;
      if (!(await prisma.supplier.findUnique({ where: { id: req.params.id } }))) throw notFound('Supplier not found');
      if (body.name) {
        await ensureUnique(
          prisma.supplier.findFirst({ where: { name: body.name, NOT: { id: req.params.id } } }),
          `Supplier "${body.name}" already exists.`
        );
      }
      const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: body });
      return ok(res, supplier);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /yarn-types/:id
mastersRoutes.patch(
  ['/yarn-types/:id', '/masters/yarn-types/:id'],
  authorize(...MASTER_ADMIN_ROLES),
  idParams,
  validate({ body: updateYarnTypeBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateYarnTypeBody>;
      if (!(await prisma.yarnType.findUnique({ where: { id: req.params.id } }))) throw notFound('Yarn type not found');
      if (body.code) {
        await ensureUnique(
          prisma.yarnType.findFirst({ where: { code: body.code, NOT: { id: req.params.id } } }),
          `Yarn type "${body.code}" already exists.`
        );
      }
      const yt = await prisma.yarnType.update({ where: { id: req.params.id }, data: body });
      return ok(res, toYarnTypeDto(yt));
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /machines/:id
mastersRoutes.patch(
  ['/machines/:id', '/masters/machines/:id'],
  authorize(...MASTER_ADMIN_ROLES),
  idParams,
  validate({ body: updateMachineBody }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateMachineBody>;
      if (!(await prisma.machine.findUnique({ where: { id: req.params.id } }))) throw notFound('Machine not found');
      if (body.code) {
        await ensureUnique(
          prisma.machine.findFirst({ where: { code: body.code, NOT: { id: req.params.id } } }),
          `Machine "${body.code}" already exists.`
        );
      }
      const m = await prisma.machine.update({ where: { id: req.params.id }, data: body });
      return ok(res, toMachineDto(m));
    } catch (err) {
      next(err);
    }
  }
);

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

// DELETE /machines/:id - blocked while any production history references the machine
mastersRoutes.delete(
  ['/machines/:id', '/masters/machines/:id'],
  authorize(...MASTER_ADMIN_ROLES),
  idParams,
  async (req, res, next) => {
    try {
      const machine = await prisma.machine.findUnique({
        where: { id: req.params.id },
        include: {
          _count: { select: { stageJobs: true, productionLogs: true, weavingRolls: true, dyeingRolls: true } },
        },
      });
      if (!machine) throw notFound('Machine not found');
      const { stageJobs, productionLogs, weavingRolls, dyeingRolls } = machine._count;
      const rolls = weavingRolls + dyeingRolls;
      if (stageJobs > 0 || productionLogs > 0 || rolls > 0) {
        const uses = [
          stageJobs > 0 && plural(stageJobs, 'stage job'),
          productionLogs > 0 && plural(productionLogs, 'production log'),
          rolls > 0 && plural(rolls, 'roll'),
        ].filter(Boolean);
        throw conflict(
          'MASTER_IN_USE',
          `Cannot delete "${machine.code}": it is used by ${uses.join(', ')}.`
        );
      }
      await prisma.machine.delete({ where: { id: machine.id } });
      return ok(res, { id: machine.id });
    } catch (err) {
      next(err);
    }
  }
);
