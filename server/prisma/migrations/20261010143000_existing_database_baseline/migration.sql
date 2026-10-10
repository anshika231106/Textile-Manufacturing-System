-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."DefectType" AS ENUM ('HOLE', 'COLOUR_MISMATCH', 'UNEVEN_WEAVE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MachineStatus" AS ENUM ('IDLE', 'RUNNING', 'BREAKDOWN');

-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('RECEIPT', 'ISSUE');

-- CreateEnum
CREATE TYPE "public"."QcResult" AS ENUM ('PASS', 'REWORK', 'REJECT');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('OWNER', 'OFFICE', 'SUPERVISOR', 'STAFF', 'STOREKEEPER');

-- CreateEnum
CREATE TYPE "public"."RollStatus" AS ENUM ('PENDING_QC', 'PASSED', 'REWORK', 'REJECTED', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "public"."Shift" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "public"."Stage" AS ENUM ('SPINNING', 'WEAVING', 'DYEING');

-- CreateEnum
CREATE TYPE "public"."StageJobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'INTERRUPTED');

-- CreateTable
CREATE TABLE "public"."Attendance" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "markedById" UUID NOT NULL,
    "date" DATE NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Buyer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Dispatch" (
    "id" UUID NOT NULL,
    "dispatchNo" TEXT NOT NULL,
    "orderId" UUID NOT NULL,
    "vehicleNo" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DispatchItem" (
    "id" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "rollId" UUID NOT NULL,
    "metres" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DispatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" UUID NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "dispatchId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Machine" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "public"."Stage" NOT NULL,
    "status" "public"."MachineStatus" NOT NULL DEFAULT 'IDLE',
    "ratePerMetre" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" UUID NOT NULL,
    "orderNo" TEXT NOT NULL,
    "buyerId" UUID NOT NULL,
    "fabricType" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "metres" DECIMAL(12,2) NOT NULL,
    "ratePerMetre" DECIMAL(12,2) NOT NULL,
    "deadline" DATE NOT NULL,
    "trackingToken" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderYarnRequirement" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "yarnTypeId" UUID NOT NULL,
    "kgPerMetre" DECIMAL(8,4) NOT NULL,

    CONSTRAINT "OrderYarnRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionLog" (
    "id" UUID NOT NULL,
    "stageJobId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "machineId" UUID NOT NULL,
    "stage" "public"."Stage" NOT NULL,
    "shift" "public"."Shift" NOT NULL,
    "metres" DECIMAL(12,2) NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,

    CONSTRAINT "ProductionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QcRecord" (
    "id" UUID NOT NULL,
    "rollId" UUID NOT NULL,
    "result" "public"."QcResult" NOT NULL,
    "defectType" "public"."DefectType",
    "notes" TEXT,
    "inspectorId" UUID NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QcRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Roll" (
    "id" UUID NOT NULL,
    "rollNo" TEXT NOT NULL,
    "orderId" UUID NOT NULL,
    "metres" DECIMAL(10,2) NOT NULL,
    "weavingMachineId" UUID NOT NULL,
    "dyeingMachineId" UUID NOT NULL,
    "status" "public"."RollStatus" NOT NULL DEFAULT 'PENDING_QC',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StageJob" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "stage" "public"."Stage" NOT NULL,
    "machineId" UUID NOT NULL,
    "status" "public"."StageJobStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "StageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" UUID NOT NULL,
    "yarnTypeId" UUID NOT NULL,
    "type" "public"."MovementType" NOT NULL,
    "kg" DECIMAL(12,3) NOT NULL,
    "ratePerKg" DECIMAL(12,2) NOT NULL,
    "supplierId" UUID,
    "orderId" UUID,
    "reference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "dailyWage" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WagePayment" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WagePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."YarnType" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "countLabel" TEXT,
    "reorderLevelKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YarnType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "public"."Attendance"("date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_staffId_date_key" ON "public"."Attendance"("staffId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_name_key" ON "public"."Buyer"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_dispatchNo_key" ON "public"."Dispatch"("dispatchNo" ASC);

-- CreateIndex
CREATE INDEX "Dispatch_orderId_idx" ON "public"."Dispatch"("orderId" ASC);

-- CreateIndex
CREATE INDEX "DispatchItem_dispatchId_idx" ON "public"."DispatchItem"("dispatchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DispatchItem_rollId_key" ON "public"."DispatchItem"("rollId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_dispatchId_key" ON "public"."Invoice"("dispatchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "public"."Invoice"("invoiceNo" ASC);

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "public"."Invoice"("issuedAt" ASC);

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "public"."Invoice"("orderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "public"."Machine"("code" ASC);

-- CreateIndex
CREATE INDEX "Machine_stage_status_idx" ON "public"."Machine"("stage" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "public"."Order"("buyerId" ASC);

-- CreateIndex
CREATE INDEX "Order_deadline_idx" ON "public"."Order"("deadline" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNo_key" ON "public"."Order"("orderNo" ASC);

-- CreateIndex
CREATE INDEX "Order_startedAt_idx" ON "public"."Order"("startedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingToken_key" ON "public"."Order"("trackingToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "OrderYarnRequirement_orderId_yarnTypeId_key" ON "public"."OrderYarnRequirement"("orderId" ASC, "yarnTypeId" ASC);

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "public"."Payment"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "Payment_paidOn_idx" ON "public"."Payment"("paidOn" ASC);

-- CreateIndex
CREATE INDEX "ProductionLog_loggedAt_idx" ON "public"."ProductionLog"("loggedAt" ASC);

-- CreateIndex
CREATE INDEX "ProductionLog_machineId_loggedAt_idx" ON "public"."ProductionLog"("machineId" ASC, "loggedAt" ASC);

-- CreateIndex
CREATE INDEX "ProductionLog_orderId_stage_idx" ON "public"."ProductionLog"("orderId" ASC, "stage" ASC);

-- CreateIndex
CREATE INDEX "QcRecord_checkedAt_idx" ON "public"."QcRecord"("checkedAt" ASC);

-- CreateIndex
CREATE INDEX "QcRecord_rollId_idx" ON "public"."QcRecord"("rollId" ASC);

-- CreateIndex
CREATE INDEX "Roll_orderId_status_idx" ON "public"."Roll"("orderId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Roll_rollNo_key" ON "public"."Roll"("rollNo" ASC);

-- CreateIndex
CREATE INDEX "Roll_status_idx" ON "public"."Roll"("status" ASC);

-- CreateIndex
CREATE INDEX "StageJob_machineId_status_idx" ON "public"."StageJob"("machineId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "StageJob_orderId_stage_idx" ON "public"."StageJob"("orderId" ASC, "stage" ASC);

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "public"."StockMovement"("orderId" ASC);

-- CreateIndex
CREATE INDEX "StockMovement_type_occurredAt_idx" ON "public"."StockMovement"("type" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "StockMovement_yarnTypeId_occurredAt_idx" ON "public"."StockMovement"("yarnTypeId" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "public"."Supplier"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "WagePayment_paidOn_idx" ON "public"."WagePayment"("paidOn" ASC);

-- CreateIndex
CREATE INDEX "WagePayment_staffId_month_idx" ON "public"."WagePayment"("staffId" ASC, "month" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "YarnType_code_key" ON "public"."YarnType"("code" ASC);

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispatch" ADD CONSTRAINT "Dispatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispatch" ADD CONSTRAINT "Dispatch_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispatchItem" ADD CONSTRAINT "DispatchItem_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispatchItem" ADD CONSTRAINT "DispatchItem_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "public"."Roll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderYarnRequirement" ADD CONSTRAINT "OrderYarnRequirement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderYarnRequirement" ADD CONSTRAINT "OrderYarnRequirement_yarnTypeId_fkey" FOREIGN KEY ("yarnTypeId") REFERENCES "public"."YarnType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionLog" ADD CONSTRAINT "ProductionLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionLog" ADD CONSTRAINT "ProductionLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "public"."Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionLog" ADD CONSTRAINT "ProductionLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionLog" ADD CONSTRAINT "ProductionLog_stageJobId_fkey" FOREIGN KEY ("stageJobId") REFERENCES "public"."StageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QcRecord" ADD CONSTRAINT "QcRecord_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QcRecord" ADD CONSTRAINT "QcRecord_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "public"."Roll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Roll" ADD CONSTRAINT "Roll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Roll" ADD CONSTRAINT "Roll_dyeingMachineId_fkey" FOREIGN KEY ("dyeingMachineId") REFERENCES "public"."Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Roll" ADD CONSTRAINT "Roll_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Roll" ADD CONSTRAINT "Roll_weavingMachineId_fkey" FOREIGN KEY ("weavingMachineId") REFERENCES "public"."Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StageJob" ADD CONSTRAINT "StageJob_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "public"."Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StageJob" ADD CONSTRAINT "StageJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_yarnTypeId_fkey" FOREIGN KEY ("yarnTypeId") REFERENCES "public"."YarnType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WagePayment" ADD CONSTRAINT "WagePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WagePayment" ADD CONSTRAINT "WagePayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
