/**
 * Gives every supervisor / office user without a monthly salary a default
 * one. Removed users are included because month-end still pays them for the
 * days they worked that month. Salaries that are already set are never changed.
 *
 *   npm run backfill:salaries              # apply
 *   npm run backfill:salaries -- --dry-run # only list who would change
 */
import { prisma } from '../src/lib/prisma';

const DEFAULT_MONTHLY_SALARY = {
  SUPERVISOR: 25_000,
  OFFICE: 30_000,
} as const;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  for (const [role, monthlySalary] of Object.entries(DEFAULT_MONTHLY_SALARY) as [keyof typeof DEFAULT_MONTHLY_SALARY, number][]) {
    const where = { role, monthlySalary: null };
    const missing = await prisma.user.findMany({ where, select: { email: true }, orderBy: { email: 'asc' } });
    console.log(`${role}: ${missing.length} without a salary${missing.length ? ` -> ${monthlySalary}` : ''}`);
    for (const { email } of missing) console.log(`  ${email}`);

    if (!dryRun && missing.length > 0) {
      const { count } = await prisma.user.updateMany({ where, data: { monthlySalary } });
      console.log(`  updated ${count}`);
    }
  }
  if (dryRun) console.log('Dry run: nothing was changed.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
