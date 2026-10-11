-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlySalary" DECIMAL(10,2),
ADD COLUMN     "salaryStartDate" DATE;

-- Existing supervisors and office users have been salaried since they joined.
UPDATE "User" SET "salaryStartDate" = "createdAt"::date WHERE "role" IN ('SUPERVISOR', 'OFFICE');
