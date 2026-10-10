import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { badRequest } from '../../lib/httpErrors';
import { ok } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';

export const attendanceRoutes = Router();

const attendanceQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate, 'Date must be a valid YYYY-MM-DD date'),
});
const wagesQuery = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM'),
});
const saveAttendanceBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate, 'Date must be a valid YYYY-MM-DD date'),
  records: z.array(z.object({
    workerId: z.string().uuid(),
    present: z.boolean(),
  })),
});

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function plantDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateValue(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

const DEFAULT_DAILY_WAGE = 550;

function dailyWage(value: { dailyWage: { toNumber(): number } | null }): number {
  return value.dailyWage?.toNumber() ?? DEFAULT_DAILY_WAGE;
}

async function loadDailyRecords(date: string, staffId?: string, includeWage = false) {
  const users = await prisma.user.findMany({
    where: { role: 'STAFF', ...(staffId ? { id: staffId } : {}) },
    select: { id: true, name: true, dailyWage: includeWage },
    orderBy: { name: 'asc' },
  });
  const attendance = await prisma.attendance.findMany({
    where: { date: dateValue(date), staffId: { in: users.map(({ id }) => id) } },
    select: { staffId: true, present: true },
  });
  const attendanceByStaff = new Map(attendance.map(({ staffId: id, present }) => [id, present]));

  return users.map((user, index) => ({
    workerId: user.id,
    workerCode: `WRK-${String(index + 1).padStart(3, '0')}`,
    workerName: user.name,
    workerRole: 'Staff',
    ...(includeWage ? { dailyWage: dailyWage(user) } : {}),
    present: attendanceByStaff.get(user.id) ?? null,
  }));
}

attendanceRoutes.get(
  '/attendance',
  authenticate,
  authorize('STAFF', 'SUPERVISOR', 'OFFICE', 'OWNER'),
  validate({ query: attendanceQuery }),
  async (req, res, next) => {
    try {
      const { date } = req.query as z.infer<typeof attendanceQuery>;
      const role = req.authUser!.role;
      const staffId = role === 'STAFF' ? req.authUser!.id : undefined;
      const includeWage = role === 'STAFF' || role === 'OFFICE' || role === 'OWNER';
      const records = await loadDailyRecords(date, staffId, includeWage);
      return ok(res, { date, records });
    } catch (err) {
      return next(err);
    }
  },
);

attendanceRoutes.post(
  '/attendance',
  authenticate,
  authorize('SUPERVISOR'),
  validate({ body: saveAttendanceBody }),
  async (req, res, next) => {
    try {
      const { date, records } = req.body as z.infer<typeof saveAttendanceBody>;
      if (date !== plantDateString(new Date())) {
        throw badRequest('ATTENDANCE_DATE_MUST_BE_TODAY', 'Supervisors can only save attendance for today');
      }

      const ids = records.map(({ workerId }) => workerId);
      if (new Set(ids).size !== ids.length) {
        throw badRequest('DUPLICATE_ATTENDANCE_RECORD', 'Each staff member can only appear once');
      }

      const staff = await prisma.user.findMany({
        where: { role: 'STAFF' },
        select: { id: true },
      });
      if (staff.length !== records.length || staff.some(({ id }) => !ids.includes(id))) {
        throw badRequest('INCOMPLETE_ATTENDANCE_ROSTER', 'Submit attendance for every current staff member');
      }

      await prisma.$transaction(
        records.map(({ workerId, present }) =>
          prisma.attendance.upsert({
            where: { staffId_date: { staffId: workerId, date: dateValue(date) } },
            create: { staffId: workerId, date: dateValue(date), present, markedById: req.authUser!.id },
            update: { present, markedById: req.authUser!.id },
          }),
        ),
      );

      return ok(res, { date, records: await loadDailyRecords(date) });
    } catch (err) {
      return next(err);
    }
  },
);

attendanceRoutes.get(
  '/attendance/wages',
  authenticate,
  authorize('STAFF', 'OFFICE', 'OWNER'),
  validate({ query: wagesQuery }),
  async (req, res, next) => {
    try {
      const { month } = req.query as z.infer<typeof wagesQuery>;
      const role = req.authUser!.role;
      const staffId = role === 'STAFF' ? req.authUser!.id : undefined;
      const [year, monthNumber] = month.split('-').map(Number);
      const start = new Date(Date.UTC(year, monthNumber - 1, 1));
      const end = new Date(Date.UTC(year, monthNumber, 1));
      const workers = await prisma.user.findMany({
        where: { role: 'STAFF', ...(staffId ? { id: staffId } : {}) },
        select: { id: true, name: true, dailyWage: true },
        orderBy: { name: 'asc' },
      });
      const attendance = await prisma.attendance.findMany({
        where: {
          staffId: { in: workers.map(({ id }) => id) },
          date: { gte: start, lt: end },
        },
        select: { staffId: true, present: true },
      });

      const totalsByStaff = new Map<string, { presentDays: number; absentDays: number }>();
      for (const { staffId: id, present } of attendance) {
        const totals = totalsByStaff.get(id) ?? { presentDays: 0, absentDays: 0 };
        totals[present ? 'presentDays' : 'absentDays'] += 1;
        totalsByStaff.set(id, totals);
      }

      const wageWorkers = workers.map((worker, index) => {
        const totals = totalsByStaff.get(worker.id) ?? { presentDays: 0, absentDays: 0 };
        const rate = dailyWage(worker);
        return {
          workerId: worker.id,
          workerCode: `WRK-${String(index + 1).padStart(3, '0')}`,
          workerName: worker.name,
          workerRole: 'Staff',
          dailyWage: rate,
          ...totals,
          totalWage: totals.presentDays * rate,
        };
      });

      return ok(res, {
        month,
        workers: wageWorkers,
        totalWages: wageWorkers.reduce((sum, worker) => sum + worker.totalWage, 0),
        totalPresentDays: wageWorkers.reduce((sum, worker) => sum + worker.presentDays, 0),
        activeWorkers: wageWorkers.length,
      });
    } catch (err) {
      return next(err);
    }
  },
);
