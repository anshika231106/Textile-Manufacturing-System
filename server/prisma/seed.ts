import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const defaultPasswordHash = await bcrypt.hash("password", 10);

  // USERS 
  const owner = await prisma.user.upsert({
    where: { email: "owner@everest.com" },
    update: { passwordHash: defaultPasswordHash },
    create: { email: "owner@everest.com", name: "Vikram Mehta", passwordHash: defaultPasswordHash, role: "OWNER" },
  });
  const office = await prisma.user.upsert({
    where: { email: "office@everest.com" },
    update: { passwordHash: defaultPasswordHash },
    create: { email: "office@everest.com", name: "Anjali Rao", passwordHash: defaultPasswordHash, role: "OFFICE" },
  });
  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@everest.com" },
    update: { passwordHash: defaultPasswordHash },
    create: { email: "supervisor@everest.com", name: "Suresh Patil", passwordHash: defaultPasswordHash, role: "SUPERVISOR" },
  });
  const staff = await prisma.user.upsert({
    where: { email: "staff1@everest.com" },
    update: { passwordHash: defaultPasswordHash },
    create: { email: "staff1@everest.com", name: "Ganesh Kumar", passwordHash: defaultPasswordHash, role: "STAFF", dailyWage: 600 },
  });
  const staff2 = await prisma.user.upsert({
    where: { email: "staff2@everest.com" },
    update: { passwordHash: defaultPasswordHash },
    create: { email: "staff2@everest.com", name: "Dinesh Rao", passwordHash: defaultPasswordHash, role: "STAFF", dailyWage: 550 },
  });

  // BUYER & SUPPLIER
  const buyer = await prisma.buyer.create({
    data: { name: "Nimesh Pathak Textiles", contactName: "Nimesh Pathak", phone: "9876543210" },
  });

  const supplier = await prisma.supplier.create({
    data: { name: "Azure Yarns Pvt Ltd", phone: "9123456780" },
  });

  // YARN TYPE + STOCK RECEIPT 
  const yarnCotton = await prisma.yarnType.create({
    data: { code: "COT-40-WHT", name: "Cotton 40s", colour: "White", countLabel: "40s", reorderLevelKg: 100 },
  });

  await prisma.stockMovement.create({
    data: {
      yarnTypeId: yarnCotton.id,
      type: "RECEIPT",
      kg: 500,
      ratePerKg: 250,
      supplierId: supplier.id,
      reference: "GRN-001",
      createdById: supervisor.id,
    },
  });

  // MACHINES
  const spinningMachine = await prisma.machine.create({
    data: { code: "SPIN-01", name: "Spinning Unit 1", stage: "SPINNING", status: "IDLE", assignedStaffId: staff.id, ratePerMetre: 2 },
  });
  const weavingMachine = await prisma.machine.create({
    data: { code: "WEAVE-01", name: "Weaving Loom 1", stage: "WEAVING", status: "IDLE", assignedStaffId: staff.id, ratePerMetre: 3 },
  });
  const dyeingMachine = await prisma.machine.create({
    data: { code: "DYE-01", name: "Dyeing Vat 1", stage: "DYEING", status: "IDLE", assignedStaffId: staff2.id, ratePerMetre: 1.5 },
  });

  // ORDER + YARN REQUIREMENT 
  const order = await prisma.order.create({
    data: {
      orderNo: "ORD-0001",
      buyerId: buyer.id,
      fabricType: "Cotton Twill",
      colour: "White",
      metres: 500,
      ratePerMetre: 180,
      deadline: new Date("2026-11-15"),
      trackingToken: "trk_" + randomUUID(),
      startedAt: new Date(),
      createdById: office.id,
    },
  });

  await prisma.orderYarnRequirement.create({
    data: { orderId: order.id, yarnTypeId: yarnCotton.id, kgPerMetre: 0.3 },
  });

  await prisma.stockMovement.create({
    data: {
      yarnTypeId: yarnCotton.id,
      type: "ISSUE",
      kg: 150,
      ratePerKg: 250,
      orderId: order.id,
      reference: "ISSUE-001",
      createdById: supervisor.id,
    },
  });

  // STAGE JOBS 
  const spinJob = await prisma.stageJob.create({
    data: { orderId: order.id, stage: "SPINNING", machineId: spinningMachine.id, status: "COMPLETED", endedAt: new Date() },
  });
  const weaveJob = await prisma.stageJob.create({
    data: { orderId: order.id, stage: "WEAVING", machineId: weavingMachine.id, status: "COMPLETED", endedAt: new Date() },
  });
  const dyeJob = await prisma.stageJob.create({
    data: { orderId: order.id, stage: "DYEING", machineId: dyeingMachine.id, status: "RUNNING" },
  });

  await prisma.machine.update({ where: { id: dyeingMachine.id }, data: { status: "RUNNING" } });

  // PRODUCTION LOGS 
  await prisma.productionLog.createMany({
    data: [
      { stageJobId: spinJob.id, orderId: order.id, machineId: spinningMachine.id, stage: "SPINNING", shift: "MORNING", metres: 200, createdById: staff.id },
      { stageJobId: weaveJob.id, orderId: order.id, machineId: weavingMachine.id, stage: "WEAVING", shift: "MORNING", metres: 200, createdById: staff.id },
      { stageJobId: dyeJob.id, orderId: order.id, machineId: dyeingMachine.id, stage: "DYEING", shift: "EVENING", metres: 200, createdById: staff2.id },
    ],
  });

  // ROLLS + QC 
  const rollPass = await prisma.roll.create({
    data: {
      rollNo: "ROLL-0001",
      orderId: order.id,
      metres: 100,
      weavingMachineId: weavingMachine.id,
      dyeingMachineId: dyeingMachine.id,
      status: "PASSED",
      createdById: staff.id,
    },
  });
  const rollRework = await prisma.roll.create({
    data: {
      rollNo: "ROLL-0002",
      orderId: order.id,
      metres: 100,
      weavingMachineId: weavingMachine.id,
      dyeingMachineId: dyeingMachine.id,
      status: "REWORK",
      createdById: staff.id,
    },
  });

  await prisma.qcRecord.create({
    data: { rollId: rollPass.id, result: "PASS", inspectorId: supervisor.id },
  });
  await prisma.qcRecord.create({
    data: { rollId: rollRework.id, result: "REWORK", defectType: "UNEVEN_WEAVE", notes: "Uneven tension on left edge", inspectorId: supervisor.id },
  });

  // DISPATCH + INVOICE + PAYMENT 
  const dispatch = await prisma.dispatch.create({
    data: { dispatchNo: "DSP-0001", orderId: order.id, vehicleNo: "MH-12-AB-1234", createdById: supervisor.id },
  });

  await prisma.dispatchItem.create({
    data: { dispatchId: dispatch.id, rollId: rollPass.id, metres: rollPass.metres },
  });

  await prisma.roll.update({ where: { id: rollPass.id }, data: { status: "DISPATCHED" } });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNo: "INV-0001",
      dispatchId: dispatch.id,
      orderId: order.id,
      amount: Number(rollPass.metres) * Number(order.ratePerMetre),
    },
  });

  await prisma.payment.create({
    data: { invoiceId: invoice.id, amount: invoice.amount, paidOn: new Date(), method: "Bank Transfer", createdById: office.id },
  });

  
  // ATTENDANCE (supervisor marks staff present)
  await prisma.attendance.create({
    data: { staffId: staff.id, markedById: supervisor.id, date: new Date(), present: true },
  });
  await prisma.attendance.create({
    data: { staffId: staff2.id, markedById: supervisor.id, date: new Date(), present: true },
  });

  // COUNTERS (so generated numbers continue after the seeded ones)
  await prisma.counter.createMany({
    data: [
      { key: "order", value: 1 },
      { key: "roll", value: 2 },
      { key: "dispatch", value: 1 },
      { key: "invoice", value: 1 },
    ],
  });

  console.log("Seed complete. Order:", order.orderNo, "| Buyer tracking token:", order.trackingToken);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());