import { prisma } from '../src/db/prisma';
import { randomUUID } from 'crypto';

export async function seedLandingOrders() {
  const users = await prisma.user.findMany();
  const officeUser = users.find(u => u.role === 'OFFICE' || u.role === 'OWNER') || users[0];
  const supervisorUser = users.find(u => u.role === 'SUPERVISOR') || users[0];

  const buyers = await prisma.buyer.findMany();
  let buyerNimesh = buyers.find(b => b.name.includes('Nimesh'));
  if (!buyerNimesh) {
    buyerNimesh = await prisma.buyer.create({
      data: { name: 'Nimesh Pathak Textiles', contactName: 'Nimesh Pathak', phone: '9876543210' },
    });
  }

  let buyerRaymond = buyers.find(b => b.name.includes('Raymond'));
  if (!buyerRaymond) {
    buyerRaymond = await prisma.buyer.create({
      data: { name: 'Raymond Apparel Ltd', contactName: 'R. Singhania', phone: '9822012345' },
    });
  }

  let buyerBombay = buyers.find(b => b.name.includes('Bombay') || b.name.includes('Lotus'));
  if (!buyerBombay) {
    buyerBombay = await prisma.buyer.create({
      data: { name: 'Bombay Dyeing & Mfg', contactName: 'B. D. Wadia', phone: '9819055443' },
    });
  }

  const yarnTypes = await prisma.yarnType.findMany();
  const cotton = yarnTypes.find(y => y.code.includes('COT')) || yarnTypes[0];
  const poly = yarnTypes.find(y => y.code.includes('POLY')) || yarnTypes[0];
  const linen = yarnTypes.find(y => y.code.includes('LIN')) || yarnTypes[0];

  const machines = await prisma.machine.findMany();
  const spinMachine = machines.find(m => m.stage === 'SPINNING') || machines[0];
  const weaveMachine = machines.find(m => m.stage === 'WEAVING') || machines[0];
  const dyeMachine = machines.find(m => m.stage === 'DYEING') || machines[0];

  // 1. ORD-2026-001 (In Production - Weaving)
  const existing1 = await prisma.order.findUnique({ where: { orderNo: 'ORD-2026-001' } });
  if (!existing1 && officeUser) {
    const ord1 = await prisma.order.create({
      data: {
        orderNo: 'ORD-2026-001',
        buyerId: buyerNimesh.id,
        fabricType: 'Cotton Twill 2/1',
        colour: 'Bleached White',
        metres: 2500,
        ratePerMetre: 145,
        deadline: new Date('2026-10-25'),
        trackingToken: 'tr_8f9a2b1c4e',
        startedAt: new Date('2026-10-01T09:30:00Z'),
        createdById: officeUser.id,
      },
    });

    if (cotton) {
      await prisma.orderYarnRequirement.create({
        data: { orderId: ord1.id, yarnTypeId: cotton.id, kgPerMetre: 0.152 },
      });
    }

    if (spinMachine) {
      const job1 = await prisma.stageJob.create({
        data: {
          orderId: ord1.id,
          stage: 'SPINNING',
          machineId: spinMachine.id,
          status: 'COMPLETED',
          endedAt: new Date('2026-10-03T18:00:00Z'),
        },
      });
      await prisma.productionLog.create({
        data: {
          stageJobId: job1.id,
          orderId: ord1.id,
          machineId: spinMachine.id,
          stage: 'SPINNING',
          shift: 'MORNING',
          metres: 2500,
          createdById: supervisorUser.id,
        },
      });
    }

    if (weaveMachine) {
      const job2 = await prisma.stageJob.create({
        data: {
          orderId: ord1.id,
          stage: 'WEAVING',
          machineId: weaveMachine.id,
          status: 'RUNNING',
          startedAt: new Date('2026-10-04T08:00:00Z'),
        },
      });
      await prisma.machine.update({ where: { id: weaveMachine.id }, data: { status: 'RUNNING' } });
      await prisma.productionLog.create({
        data: {
          stageJobId: job2.id,
          orderId: ord1.id,
          machineId: weaveMachine.id,
          stage: 'WEAVING',
          shift: 'MORNING',
          metres: 1400,
          createdById: supervisorUser.id,
        },
      });
    }
  }

  // 2. ORD-2026-002 (Pending)
  const existing2 = await prisma.order.findUnique({ where: { orderNo: 'ORD-2026-002' } });
  if (!existing2 && officeUser) {
    const ord2 = await prisma.order.create({
      data: {
        orderNo: 'ORD-2026-002',
        buyerId: buyerRaymond.id,
        fabricType: 'Poly-Cotton Blend Suiting',
        colour: 'Navy Blue',
        metres: 1800,
        ratePerMetre: 220,
        deadline: new Date('2026-10-30'),
        trackingToken: 'tr_1b4c7d9e2a',
        startedAt: null,
        createdById: officeUser.id,
      },
    });

    if (cotton) {
      await prisma.orderYarnRequirement.create({
        data: { orderId: ord2.id, yarnTypeId: cotton.id, kgPerMetre: 0.083 },
      });
    }
    if (poly) {
      await prisma.orderYarnRequirement.create({
        data: { orderId: ord2.id, yarnTypeId: poly.id, kgPerMetre: 0.067 },
      });
    }
  }

  // 3. ORD-2026-003 (In QC / Ready Rolls)
  const existing3 = await prisma.order.findUnique({ where: { orderNo: 'ORD-2026-003' } });
  if (!existing3 && officeUser) {
    const ord3 = await prisma.order.create({
      data: {
        orderNo: 'ORD-2026-003',
        buyerId: buyerBombay.id,
        fabricType: 'Linen Slub Voile',
        colour: 'Raw Ivory',
        metres: 3000,
        ratePerMetre: 310,
        deadline: new Date('2026-10-18'),
        trackingToken: 'tr_9e8d7c6b5a',
        startedAt: new Date('2026-09-28T11:00:00Z'),
        createdById: officeUser.id,
      },
    });

    if (linen) {
      await prisma.orderYarnRequirement.create({
        data: { orderId: ord3.id, yarnTypeId: linen.id, kgPerMetre: 0.14 },
      });
    }

    if (spinMachine) {
      await prisma.stageJob.create({
        data: {
          orderId: ord3.id,
          stage: 'SPINNING',
          machineId: spinMachine.id,
          status: 'COMPLETED',
          endedAt: new Date('2026-10-01'),
        },
      });
    }
    if (weaveMachine) {
      await prisma.stageJob.create({
        data: {
          orderId: ord3.id,
          stage: 'WEAVING',
          machineId: weaveMachine.id,
          status: 'COMPLETED',
          endedAt: new Date('2026-10-04'),
        },
      });
    }
    if (dyeMachine) {
      const dyeJob = await prisma.stageJob.create({
        data: {
          orderId: ord3.id,
          stage: 'DYEING',
          machineId: dyeMachine.id,
          status: 'COMPLETED',
          endedAt: new Date('2026-10-07'),
        },
      });
      await prisma.productionLog.create({
        data: {
          stageJobId: dyeJob.id,
          orderId: ord3.id,
          machineId: dyeMachine.id,
          stage: 'DYEING',
          shift: 'MORNING',
          metres: 3000,
          createdById: supervisorUser.id,
        },
      });
    }

    if (weaveMachine && dyeMachine) {
      for (let i = 1; i <= 6; i++) {
        const rollStatus = i <= 4 ? 'PASSED' : 'PENDING_QC';
        const roll = await prisma.roll.create({
          data: {
            rollNo: `ORD-2026-003-R0${i}`,
            orderId: ord3.id,
            metres: 500,
            weavingMachineId: weaveMachine.id,
            dyeingMachineId: dyeMachine.id,
            status: rollStatus,
            createdById: supervisorUser.id,
          },
        });
        if (i <= 4) {
          await prisma.qcRecord.create({
            data: {
              rollId: roll.id,
              result: 'PASS',
              inspectorId: supervisorUser.id,
            },
          });
        }
      }
    }
  }

  console.log('Landing orders verified / seeded in database successfully.');
}

if (require.main === module) {
  seedLandingOrders().then(() => prisma.$disconnect());
}
