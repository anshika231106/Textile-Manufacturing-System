import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { badRequest } from '../../lib/httpErrors';
import { ok } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { toDecimal } from '../../lib/numbers';

export const attendanceRoutes = Router();

const DEFAULT_DAILY_WAGE = 550;

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw badRequest('INVALID_DATE', 'Invalid date');
  return d;
}

async function getStaffRoster() {
  return prisma.user.findMany({
    where: { role: 'STAFF' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, dailyWage: true },
  });
}

function workerCode(index: number): string {
  return `WRK-${String(index + 1).padStart(3, '0')}`;
}

const dateQuery = z.object({ date: z.string().min(1) });

// GET /attendance?date=YYYY-MM-DD - attendance for every STAFF worker on a given date
attendanceRoutes.get(
  '/attendance',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ query: dateQuery }),
  async (req, res, next) => {
    try {
      const { date } = req.query as { date: string };
      const day = parseDateOnly(date);

      const [staff, records] = await Promise.all([
        getStaffRoster(),
        prisma.attendance.findMany({ where: { date: day } }),
      ]);
      const presentMap = new Map(records.map((r) => [r.staffId, r.present]));

      return ok(res, {
        date,
        records: staff.map((w, idx) => ({
          workerId: w.id,
          workerCode: workerCode(idx),
          workerName: w.name,
          workerRole: 'STAFF',
          dailyWage: w.dailyWage ? toDecimal(w.dailyWage) : DEFAULT_DAILY_WAGE,
          present: presentMap.has(w.id) ? presentMap.get(w.id)! : true,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

const saveBody = z.object({
  date: z.string().min(1),
  records: z
    .array(z.object({ workerId: z.string().uuid(), present: z.boolean() }))
    .min(1),
});

// POST /attendance - upsert attendance per worker per date (never duplicates a row)
attendanceRoutes.post(
  '/attendance',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ body: saveBody }),
  async (req, res, next) => {
    try {
      const input = saveBody.parse(req.body);
      const day = parseDateOnly(input.date);
      const markedById = req.authUser!.id;

      await prisma.$transaction(
        input.records.map((r) =>
          prisma.attendance.upsert({
            where: { staffId_date: { staffId: r.workerId, date: day } },
            update: { present: r.present, markedById },
            create: { staffId: r.workerId, date: day, present: r.present, markedById },
          })
        )
      );

      const [staff, records] = await Promise.all([
        getStaffRoster(),
        prisma.attendance.findMany({ where: { date: day } }),
      ]);
      const presentMap = new Map(records.map((r) => [r.staffId, r.present]));

      return ok(res, {
        date: input.date,
        records: staff.map((w, idx) => ({
          workerId: w.id,
          workerCode: workerCode(idx),
          workerName: w.name,
          workerRole: 'STAFF',
          dailyWage: w.dailyWage ? toDecimal(w.dailyWage) : DEFAULT_DAILY_WAGE,
          present: presentMap.has(w.id) ? presentMap.get(w.id)! : true,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

const monthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM') });

// GET /attendance/wages?month=YYYY-MM - present days x daily wage per worker (UTC calendar month, A-09)
attendanceRoutes.get(
  '/attendance/wages',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  validate({ query: monthQuery }),
  async (req, res, next) => {
    try {
      const { month } = req.query as { month: string };
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);

      const [staff, records] = await Promise.all([
        getStaffRoster(),
        prisma.attendance.findMany({
          where: { date: { gte: start, lt: end }, present: true },
          select: { staffId: true },
        }),
      ]);

      const presentCount = new Map<string, number>();
      for (const r of records) {
        presentCount.set(r.staffId, (presentCount.get(r.staffId) || 0) + 1);
      }

      const workers = staff.map((w, idx) => {
        const dailyWage = w.dailyWage ? toDecimal(w.dailyWage) : DEFAULT_DAILY_WAGE;
        const presentDays = presentCount.get(w.id) || 0;
        return {
          workerId: w.id,
          workerCode: workerCode(idx),
          workerName: w.name,
          workerRole: 'STAFF',
          dailyWage,
          presentDays,
          totalWage: presentDays * dailyWage,
        };
      });

      return ok(res, {
        month,
        workers,
        totalWages: workers.reduce((sum, w) => sum + w.totalWage, 0),
        totalPresentDays: workers.reduce((sum, w) => sum + w.presentDays, 0),
        activeWorkers: workers.length,
      });
    } catch (err) {
      next(err);
    }
  }
);
