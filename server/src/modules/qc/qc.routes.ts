import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/httpErrors';
import { ok, created } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { round2, toDecimal } from '../../lib/numbers';

export const qcRoutes = Router();

const rollInclude = {
  order: { include: { buyer: true } },
  weavingMachine: true,
  dyeingMachine: true,
  qcRecords: {
    orderBy: { checkedAt: 'desc' as const },
    take: 1,
    include: { inspector: { select: { name: true } } },
  },
};

function mapRoll(roll: any) {
  const qc = roll.qcRecords?.[0];
  return {
    id: roll.id,
    rollNo: roll.rollNo,
    orderId: roll.orderId,
    orderNumber: roll.order.orderNo,
    buyerName: roll.order.buyer.name,
    fabricType: roll.order.fabricType,
    colour: roll.order.colour,
    metres: toDecimal(roll.metres),
    weavingMachineId: roll.weavingMachineId,
    weavingMachineName: roll.weavingMachine.name,
    dyeingMachineId: roll.dyeingMachineId,
    dyeingMachineName: roll.dyeingMachine.name,
    status: roll.status,
    lastResult: qc?.result,
    defectType: qc?.defectType ?? undefined,
    notes: qc?.notes ?? undefined,
    createdAt: roll.createdAt.toISOString(),
    inspectedAt: qc?.checkedAt?.toISOString(),
    inspectorName: qc?.inspector?.name,
  };
}

const STAGES = ['SPINNING', 'WEAVING', 'DYEING'] as const;

const rollableOrderInclude = {
  buyer: true,
  stageJobs: {
    orderBy: { startedAt: 'desc' as const },
    include: { machine: { select: { id: true, code: true, name: true } } },
  },
  productionLogs: { where: { stage: 'DYEING' as const }, select: { metres: true } },
  rolls: { select: { metres: true } },
};

/**
 * Rolls can only be cut once all three stages are finished: the latest job of
 * SPINNING, WEAVING and DYEING must each be COMPLETED. Machines are limited to
 * the ones that actually ran a job of that stage for the order.
 */
function rollEligibility(order: any) {
  const stagesComplete = STAGES.every(
    (stage) => order.stageJobs.find((j: any) => j.stage === stage)?.status === 'COMPLETED'
  );
  const machinesFor = (stage: string) => {
    const seen = new Map<string, { id: string; code: string; name: string }>();
    for (const job of order.stageJobs) {
      if (job.stage === stage && !seen.has(job.machine.id)) seen.set(job.machine.id, job.machine);
    }
    return [...seen.values()];
  };
  const dyeingOutput = order.productionLogs.reduce((sum: number, l: any) => sum + toDecimal(l.metres), 0);
  const alreadyRolled = order.rolls.reduce((sum: number, r: any) => sum + toDecimal(r.metres), 0);
  return {
    stagesComplete,
    dyeingOutput: round2(dyeingOutput),
    alreadyRolled: round2(alreadyRolled),
    remainingMetres: round2(Math.max(dyeingOutput - alreadyRolled, 0)),
    weavingMachines: machinesFor('WEAVING'),
    dyeingMachines: machinesFor('DYEING'),
  };
}

// GET /qc/roll-orders - orders that have finished all three stages and still have un-rolled dyeing output
qcRoutes.get(
  '/qc/roll-orders',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  async (_req, res, next) => {
    try {
      const orders = await prisma.order.findMany({
        where: { stageJobs: { some: { stage: 'DYEING', status: 'COMPLETED' } } },
        orderBy: { createdAt: 'desc' },
        include: rollableOrderInclude,
      });
      const items = orders
        .map((order) => ({ order, eligibility: rollEligibility(order) }))
        .filter(({ eligibility }) => eligibility.stagesComplete && eligibility.remainingMetres > 0)
        .map(({ order, eligibility }) => ({
          id: order.id,
          orderNumber: order.orderNo,
          buyerName: order.buyer.name,
          fabricType: order.fabricType,
          colour: order.colour,
          metres: toDecimal(order.metres),
          dyeingOutput: eligibility.dyeingOutput,
          alreadyRolled: eligibility.alreadyRolled,
          remainingMetres: eligibility.remainingMetres,
          weavingMachines: eligibility.weavingMachines,
          dyeingMachines: eligibility.dyeingMachines,
        }));
      return ok(res, items);
    } catch (err) {
      next(err);
    }
  }
);

// GET /qc/queue - all rolls, newest first (pending/rework surfaced by the client's own filters)
qcRoutes.get(
  '/qc/queue',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  async (_req, res, next) => {
    try {
      const rolls = await prisma.roll.findMany({
        orderBy: { createdAt: 'desc' },
        include: rollInclude,
      });
      return ok(res, rolls.map(mapRoll));
    } catch (err) {
      next(err);
    }
  }
);

const createRollBody = z.object({
  orderId: z.string().uuid(),
  metres: z.number().positive(),
  weavingMachineId: z.string().uuid(),
  dyeingMachineId: z.string().uuid(),
});

// POST /qc/rolls - create a roll from dyeing output (API-30)
qcRoutes.post(
  '/qc/rolls',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ body: createRollBody }),
  async (req, res, next) => {
    try {
      const input = createRollBody.parse(req.body);

      const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: rollableOrderInclude });
      if (!order) throw notFound('Order not found');
      if (!rollEligibility(order).stagesComplete) {
        throw conflict(
          'STAGES_INCOMPLETE',
          'Rolls can only be created after spinning, weaving and dyeing are all completed for this order'
        );
      }

      const [weavingMachine, dyeingMachine] = await Promise.all([
        prisma.machine.findUnique({ where: { id: input.weavingMachineId } }),
        prisma.machine.findUnique({ where: { id: input.dyeingMachineId } }),
      ]);
      if (!weavingMachine || weavingMachine.stage !== 'WEAVING') {
        throw badRequest('INVALID_MACHINE', 'weavingMachineId must reference a WEAVING-stage machine');
      }
      if (!dyeingMachine || dyeingMachine.stage !== 'DYEING') {
        throw badRequest('INVALID_MACHINE', 'dyeingMachineId must reference a DYEING-stage machine');
      }

      const [weavingJob, dyeingJob] = await Promise.all([
        prisma.stageJob.findFirst({
          where: { orderId: input.orderId, machineId: input.weavingMachineId, stage: 'WEAVING' },
        }),
        prisma.stageJob.findFirst({
          where: { orderId: input.orderId, machineId: input.dyeingMachineId, stage: 'DYEING' },
        }),
      ]);
      if (!weavingJob) throw badRequest('MACHINE_NOT_WORKED', 'Selected weaving machine has not worked on this order');
      if (!dyeingJob) throw badRequest('MACHINE_NOT_WORKED', 'Selected dyeing machine has not worked on this order');

      const [dyeingOutputAgg, rolledAgg] = await Promise.all([
        prisma.productionLog.aggregate({
          where: { orderId: input.orderId, stage: 'DYEING' },
          _sum: { metres: true },
        }),
        prisma.roll.aggregate({
          where: { orderId: input.orderId },
          _sum: { metres: true },
        }),
      ]);
      const dyeingOutput = toDecimal(dyeingOutputAgg._sum.metres);
      const alreadyRolled = toDecimal(rolledAgg._sum.metres);
      if (alreadyRolled + input.metres > dyeingOutput + 1e-6) {
        throw unprocessable('EXCEEDS_STAGE_OUTPUT', 'Roll metres exceed remaining dyeing output for this order', {
          dyeingOutput: round2(dyeingOutput),
          alreadyRolled: round2(alreadyRolled),
          remainingMetres: round2(Math.max(dyeingOutput - alreadyRolled, 0)),
        });
      }

      const existingRollCount = await prisma.roll.count({ where: { orderId: input.orderId } });
      const rollNo = `${order.orderNo}-R${String(existingRollCount + 1).padStart(2, '0')}`;

      const roll = await prisma.roll.create({
        data: {
          rollNo,
          orderId: input.orderId,
          metres: input.metres,
          weavingMachineId: input.weavingMachineId,
          dyeingMachineId: input.dyeingMachineId,
          createdById: req.authUser!.id,
        },
        include: rollInclude,
      });

      return created(res, mapRoll(roll));
    } catch (err) {
      next(err);
    }
  }
);

const resultBody = z
  .object({
    result: z.enum(['PASS', 'REWORK', 'REJECT']),
    defectType: z.enum(['HOLE', 'COLOUR_MISMATCH', 'UNEVEN_WEAVE', 'OTHER']).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.result === 'PASS' || !!d.defectType, {
    message: 'defectType is required unless result is PASS',
    path: ['defectType'],
  });

const rollIdParams = z.object({ id: z.string().uuid() });

// POST /qc/rolls/:id/result - record a QC verdict (API-32)
qcRoutes.post(
  '/qc/rolls/:id/result',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ params: rollIdParams, body: resultBody }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const input = resultBody.parse(req.body);

      const roll = await prisma.roll.findUnique({ where: { id } });
      if (!roll) throw notFound('Roll not found');
      if (roll.status !== 'PENDING_QC' && roll.status !== 'REWORK') {
        throw conflict('ROLL_NOT_INSPECTABLE', `Roll is ${roll.status} and cannot be inspected again`);
      }

      const nextStatus = input.result === 'PASS' ? 'PASSED' : input.result === 'REWORK' ? 'REWORK' : 'REJECTED';

      const updated = await prisma.$transaction(async (tx) => {
        await tx.qcRecord.create({
          data: {
            rollId: id,
            result: input.result,
            defectType: input.result === 'PASS' ? null : input.defectType,
            notes: input.notes,
            inspectorId: req.authUser!.id,
          },
        });
        return tx.roll.update({
          where: { id },
          data: { status: nextStatus },
          include: rollInclude,
        });
      });

      return ok(res, mapRoll(updated));
    } catch (err) {
      next(err);
    }
  }
);
