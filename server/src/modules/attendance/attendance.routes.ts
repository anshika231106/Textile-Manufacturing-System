import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { badRequest } from '../../lib/httpErrors';
import { ok } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  dailyWageOf,
  isSalariedRole,
  plantDateString,
  salariesForMonth,
  staffWagesForMonth,
} from '../../lib/payroll';

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
const updateWageParams = z.object({ staffId: z.string().uuid() });
const updateWageBody = z.object({
  dailyWage: z.number().finite().min(0).max(999999.99),
});
const updateSalaryBody = z.object({
  monthlySalary: z.number().finite().min(0).max(99999999.99),
});

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateValue(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

// Only STAFF are on the attendance roster; SUPERVISOR and OFFICE are salaried.
async function loadDailyRecords(date: string, staffId?: string, includeWage = false) {
  const users = await prisma.user.findMany({
    where: { role: 'STAFF', deletedAt: null, ...(staffId ? { id: staffId } : {}) },
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
    ...(includeWage ? { dailyWage: dailyWageOf(user) } : {}),
    present: attendanceByStaff.get(user.id) ?? false,
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
        where: { role: 'STAFF', deletedAt: null },
        select: { id: true },
      });
      if (staff.length !== records.length || staff.some(({ id }) => !ids.includes(id))) {
        throw badRequest('INCOMPLETE_ATTENDANCE_ROSTER', 'Submit attendance for every current staff member');
      }

      const attendanceDate = dateValue(date);
      await prisma.$transaction([
        prisma.attendance.deleteMany({
          where: { staffId: { in: ids }, date: attendanceDate },
        }),
        prisma.attendance.createMany({
          data: records.map(({ workerId, present }) => ({
            staffId: workerId,
            date: attendanceDate,
            present,
            markedById: req.authUser!.id,
          })),
        }),
      ], { maxWait: 10_000, timeout: 15_000 });

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
      const staffId = req.authUser!.role === 'STAFF' ? req.authUser!.id : undefined;
      const { workers, totalWages, totalPresentDays } = await staffWagesForMonth(month, staffId);
      return ok(res, {
        month,
        workers,
        totalWages,
        totalPresentDays,
        activeWorkers: workers.length,
      });
    } catch (err) {
      return next(err);
    }
  },
);

attendanceRoutes.patch(
  '/attendance/staff/:staffId/wage',
  authenticate,
  authorize('OFFICE', 'OWNER'),
  validate({ params: updateWageParams, body: updateWageBody }),
  async (req, res, next) => {
    try {
      const { staffId } = req.params as z.infer<typeof updateWageParams>;
      const { dailyWage: updatedDailyWage } = req.body as z.infer<typeof updateWageBody>;
      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, role: true, deletedAt: true },
      });
      if (!staff || staff.role !== 'STAFF' || staff.deletedAt) {
        throw badRequest('INVALID_STAFF', 'Wages can only be updated for staff users');
      }

      const updated = await prisma.user.update({
        where: { id: staffId },
        data: { dailyWage: updatedDailyWage },
        select: { id: true, dailyWage: true },
      });
      return ok(res, {
        staffId: updated.id,
        dailyWage: dailyWageOf(updated),
      });
    } catch (err) {
      return next(err);
    }
  },
);

// Supervisors see only their own salary; office and owner see every salaried employee.
attendanceRoutes.get(
  '/attendance/salaries',
  authenticate,
  authorize('SUPERVISOR', 'OFFICE', 'OWNER'),
  validate({ query: wagesQuery }),
  async (req, res, next) => {
    try {
      const { month } = req.query as z.infer<typeof wagesQuery>;
      const userId = req.authUser!.role === 'SUPERVISOR' ? req.authUser!.id : undefined;
      return ok(res, { month, ...(await salariesForMonth(month, userId)) });
    } catch (err) {
      return next(err);
    }
  },
);

// Only the owner sets salaries, so office users cannot change their own pay.
attendanceRoutes.patch(
  '/attendance/staff/:staffId/salary',
  authenticate,
  authorize('OWNER'),
  validate({ params: updateWageParams, body: updateSalaryBody }),
  async (req, res, next) => {
    try {
      const { staffId } = req.params as z.infer<typeof updateWageParams>;
      const { monthlySalary } = req.body as z.infer<typeof updateSalaryBody>;
      const employee = await prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, role: true, deletedAt: true },
      });
      if (!employee || !isSalariedRole(employee.role) || employee.deletedAt) {
        throw badRequest('INVALID_SALARIED_EMPLOYEE', 'Monthly salaries can only be set for supervisors and office users');
      }

      const updated = await prisma.user.update({
        where: { id: staffId },
        data: { monthlySalary },
        select: { id: true, monthlySalary: true },
      });
      return ok(res, {
        staffId: updated.id,
        monthlySalary: updated.monthlySalary ? updated.monthlySalary.toNumber() : 0,
      });
    } catch (err) {
      return next(err);
    }
  },
);
