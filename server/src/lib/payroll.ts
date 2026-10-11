// Payroll rules shared by the attendance screens and the month-end report.
// STAFF are paid a daily wage for each day marked present. SUPERVISOR and
// OFFICE are paid a fixed monthly salary and are not on the attendance roster.
import { prisma } from '../db/prisma';
import type { Role } from '../../generated/prisma/client';
import { round2, toDecimal } from './numbers';

export const DEFAULT_DAILY_WAGE = 550;
export const SALARIED_ROLES = ['SUPERVISOR', 'OFFICE'] as const satisfies readonly Role[];

const DAY_MS = 86_400_000;

export function isSalariedRole(role: Role): boolean {
  return (SALARIED_ROLES as readonly Role[]).includes(role);
}

export function dailyWageOf(user: { dailyWage: { toNumber(): number } | null }): number {
  return user.dailyWage ? toDecimal(user.dailyWage) : DEFAULT_DAILY_WAGE;
}

/** Calendar date (YYYY-MM-DD) at the plant, which runs on India time. */
export function plantDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function plantDateValue(date: Date): Date {
  return new Date(`${plantDateString(date)}T00:00:00.000Z`);
}

export function monthRange(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

/**
 * Daily-wage earnings for one month, built from the month's attendance rows so
 * that people who were later promoted or removed are still paid for the days
 * they worked as staff. Current staff with no rows yet are listed with zero days.
 */
export async function staffWagesForMonth(month: string, staffId?: string) {
  const { start, end } = monthRange(month);
  const workers = await prisma.user.findMany({
    where: {
      ...(staffId ? { id: staffId } : {}),
      OR: [
        { role: 'STAFF', deletedAt: null },
        { attendanceRecords: { some: { date: { gte: start, lt: end } } } },
      ],
    },
    select: { id: true, name: true, dailyWage: true },
    orderBy: { name: 'asc' },
  });
  const attendance = await prisma.attendance.findMany({
    where: { staffId: { in: workers.map(({ id }) => id) }, date: { gte: start, lt: end } },
    select: { staffId: true, present: true },
  });

  const totalsByStaff = new Map<string, { presentDays: number; absentDays: number }>();
  for (const { staffId: id, present } of attendance) {
    const totals = totalsByStaff.get(id) ?? { presentDays: 0, absentDays: 0 };
    totals[present ? 'presentDays' : 'absentDays'] += 1;
    totalsByStaff.set(id, totals);
  }

  const rows = workers.map((worker, index) => {
    const totals = totalsByStaff.get(worker.id) ?? { presentDays: 0, absentDays: 0 };
    const rate = dailyWageOf(worker);
    return {
      workerId: worker.id,
      workerCode: `WRK-${String(index + 1).padStart(3, '0')}`,
      workerName: worker.name,
      workerRole: 'Staff',
      dailyWage: rate,
      ...totals,
      totalWage: round2(totals.presentDays * rate),
    };
  });

  return {
    workers: rows,
    totalWages: round2(rows.reduce((sum, row) => sum + row.totalWage, 0)),
    totalPresentDays: rows.reduce((sum, row) => sum + row.presentDays, 0),
  };
}

/**
 * Fixed monthly salaries for SUPERVISOR and OFFICE users. Someone who became
 * salaried, or was removed, part-way through the month is paid for the
 * calendar days they were on a salaried role.
 */
export async function salariesForMonth(month: string, userId?: string) {
  const { start, end } = monthRange(month);
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...SALARIED_ROLES] },
      ...(userId ? { id: userId } : {}),
      OR: [{ salaryStartDate: null }, { salaryStartDate: { lt: end } }],
      AND: [{ OR: [{ deletedAt: null }, { deletedAt: { gte: start } }] }],
      createdAt: { lt: end },
    },
    select: { id: true, name: true, role: true, monthlySalary: true, salaryStartDate: true, createdAt: true, deletedAt: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  const rows = users.map((user, index) => {
    const salaried = user.salaryStartDate ?? plantDateValue(user.createdAt);
    const from = Math.max(start.getTime(), salaried.getTime());
    // A user removed on a given day is not paid for that day.
    const until = user.deletedAt ? Math.min(end.getTime(), plantDateValue(user.deletedAt).getTime()) : end.getTime();
    const paidDays = Math.max(0, Math.round((until - from) / DAY_MS));
    const monthlySalary = user.monthlySalary ? toDecimal(user.monthlySalary) : null;
    return {
      employeeId: user.id,
      employeeCode: `EMP-${String(index + 1).padStart(3, '0')}`,
      employeeName: user.name,
      role: user.role,
      monthlySalary,
      paidDays,
      daysInMonth,
      salaryDue: round2(((monthlySalary ?? 0) * paidDays) / daysInMonth),
    };
  });

  return {
    employees: rows,
    totalSalaries: round2(rows.reduce((sum, row) => sum + row.salaryDue, 0)),
    salaryNotSet: rows.filter((row) => row.monthlySalary === null).length,
  };
}
