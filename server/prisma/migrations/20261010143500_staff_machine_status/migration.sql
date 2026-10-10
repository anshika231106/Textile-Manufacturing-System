-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'OFFICE', 'SUPERVISOR', 'STAFF');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
    CASE WHEN "role"::text = 'STOREKEEPER' THEN 'SUPERVISOR' ELSE "role"::text END
)::"Role_new";
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "assignedStaffId" UUID,
ADD COLUMN     "statusNote" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "statusUpdatedById" UUID;

-- AlterTable
ALTER TABLE "ProductionLog" ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "Machine_assignedStaffId_idx" ON "Machine"("assignedStaffId");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
