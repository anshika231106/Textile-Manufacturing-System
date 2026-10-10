import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { badRequest, conflict, notFound, unauthenticated, unprocessable } from '../../lib/httpErrors';
import { ok } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { checkCanStartStage, checkStageCap, type LoggedByStage } from '../../domain/stageRules';

export const floorRoutes = Router();

const machineParams = z.object({ machineId: z.string().uuid() });
const jobParams = z.object({ jobId: z.string().uuid() });
const assignmentBody = z.object({ staffId: z.string().uuid().nullable() });
const statusBody = z.object({
  status: z.enum(['IDLE', 'RUNNING', 'BREAKDOWN']),
  note: z.string().trim().max(500).optional(),
});
const startJobBody = z.object({
  machineId: z.string().uuid(),
  orderId: z.string().uuid(),
  stage: z.enum(['SPINNING', 'WEAVING', 'DYEING']),
  shift: z.enum(['MORNING', 'EVENING', 'NIGHT']).optional(),
});
const productionLogBody = z.object({
  stageJobId: z.string().uuid().optional(),
  machineId: z.string().uuid(),
  orderId: z.string().uuid(),
  stage: z.enum(['SPINNING', 'WEAVING', 'DYEING']),
  shift: z.enum(['MORNING', 'EVENING', 'NIGHT']),
  metres: z.number().positive().finite(),
  notes: z.string().trim().max(500).optional(),
});
const logQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

async function loggedByStage(orderId: string): Promise<LoggedByStage> {
  const rows = await prisma.productionLog.groupBy({
    by: ['stage'],
    where: { orderId },
    _sum: { metres: true },
  });
  const logged: LoggedByStage = { SPINNING: 0, WEAVING: 0, DYEING: 0 };
  for (const row of rows) logged[row.stage] = Number(row._sum.metres ?? 0);
  return logged;
}

function actorId(req: Request): string {
  if (!req.authUser) throw unauthenticated();
  return req.authUser.id;
}

floorRoutes.get(
  '/floor/staff',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  async (_req, res, next) => {
    try {
      const staff = await prisma.user.findMany({
        where: { role: 'STAFF', deletedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });
      return ok(res, staff);
    } catch (err) {
      return next(err);
    }
  },
);

floorRoutes.get(
  '/floor/board',
  authenticate,
  authorize('OWNER', 'SUPERVISOR', 'STAFF'),
  async (req, res, next) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const machines = await prisma.machine.findMany({
        where: {
          retiredAt: null,
          ...(req.authUser?.role === 'STAFF' ? { assignedStaffId: req.authUser.id } : {}),
        },
        include: {
          assignedStaff: { select: { id: true, name: true, email: true } },
          statusUpdatedBy: { select: { id: true, name: true } },
          productionLogs: {
            where: { loggedAt: { gte: today } },
            select: { metres: true },
          },
          stageJobs: {
            where: { status: 'RUNNING' },
            take: 1,
            orderBy: { startedAt: 'desc' },
            include: {
              order: { include: { buyer: true } },
              logs: { orderBy: { loggedAt: 'desc' } },
            },
          },
        },
        orderBy: [{ stage: 'asc' }, { code: 'asc' }],
      });

      const result = machines.map((machine) => {
        const job = machine.stageJobs[0];
        const latestLog = job?.logs[0];
        return {
          id: machine.id,
          code: machine.code,
          name: machine.name,
          stage: machine.stage,
          status: machine.status,
          ratePerMetre: Number(machine.ratePerMetre),
          assignedStaff: machine.assignedStaff,
          statusUpdatedBy: machine.statusUpdatedBy,
          statusUpdatedAt: machine.statusUpdatedAt,
          statusNote: machine.statusNote,
          metresToday: machine.productionLogs.reduce((total, log) => total + Number(log.metres), 0),
          breakdownReportedAt: machine.status === 'BREAKDOWN' ? machine.statusUpdatedAt?.toISOString() : undefined,
          currentJob: job
            ? {
                id: job.id,
                orderId: job.orderId,
                orderNumber: job.order.orderNo,
                buyerName: job.order.buyer.name,
                fabricType: job.order.fabricType,
                colour: job.order.colour,
                stage: job.stage,
                targetMetres: Number(job.order.metres),
                producedMetres: job.logs.reduce((total, log) => total + Number(log.metres), 0),
                startedAt: job.startedAt.toISOString(),
                shift: latestLog?.shift,
              }
            : null,
        };
      });

      const running = result.filter((machine) => machine.status === 'RUNNING').length;
      const idle = result.filter((machine) => machine.status === 'IDLE').length;
      const breakdown = result.filter((machine) => machine.status === 'BREAKDOWN').length;
      const totalMetresToday = result.reduce((total, machine) => total + machine.metresToday, 0);
      return ok(res, {
        machines: result,
        stats: {
          totalMachines: result.length,
          running,
          idle,
          breakdown,
          totalMetresToday,
          utilizationRate: result.length ? Math.round((running / result.length) * 100) : 0,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

floorRoutes.patch(
  '/floor/machines/:machineId/assignment',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ params: machineParams, body: assignmentBody }),
  async (req, res, next) => {
    try {
      const { machineId } = machineParams.parse(req.params);
      const { staffId } = assignmentBody.parse(req.body);
      if (staffId) {
        const staff = await prisma.user.findUnique({ where: { id: staffId }, select: { role: true, deletedAt: true } });
        if (!staff || staff.deletedAt) throw notFound('Staff member not found');
        if (staff.role !== 'STAFF') throw badRequest('INVALID_STAFF', 'Machines can only be assigned to staff users');
      }

      const machine = await prisma.machine.update({
        where: { id: machineId },
        data: { assignedStaffId: staffId },
        select: {
          id: true,
          assignedStaff: { select: { id: true, name: true, email: true } },
        },
      });
      return ok(res, machine);
    } catch (err) {
      return next(err);
    }
  },
);

floorRoutes.patch(
  '/floor/machines/:machineId/status',
  authenticate,
  authorize('OWNER', 'SUPERVISOR', 'STAFF'),
  validate({ params: machineParams, body: statusBody }),
  async (req, res, next) => {
    try {
      const { machineId } = machineParams.parse(req.params);
      const { status, note } = statusBody.parse(req.body);
      const updaterId = actorId(req);

      const isStaff = req.authUser?.role === 'STAFF';
      const machine = await prisma.machine.findFirst({
        where: { id: machineId, ...(isStaff ? { assignedStaffId: updaterId } : {}) },
        select: { id: true },
      });
      if (!machine) throw notFound(isStaff ? 'Assigned machine not found' : 'Machine not found');

      if (status === 'IDLE') {
        const activeJob = await prisma.stageJob.findFirst({
          where: { machineId, status: 'RUNNING' },
          select: { id: true },
        });
        if (activeJob) {
          throw conflict('ACTIVE_JOB', 'Complete or stop the active production job before marking this machine idle');
        }
      }

      const updated = await prisma.machine.update({
        where: { id: machineId },
        data: {
          status,
          statusUpdatedById: updaterId,
          statusUpdatedAt: new Date(),
          statusNote: status === 'BREAKDOWN' ? note ?? null : null,
        },
        select: {
          id: true,
          status: true,
          statusUpdatedAt: true,
          statusNote: true,
          statusUpdatedBy: { select: { id: true, name: true } },
        },
      });
      return ok(res, updated);
    } catch (err) {
      return next(err);
    }
  },
);

floorRoutes.post(
  '/floor/jobs',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ body: startJobBody }),
  async (req, res, next) => {
    try {
      const input = startJobBody.parse(req.body);
      const machine = await prisma.machine.findUnique({
        where: { id: input.machineId },
        select: { id: true, stage: true, status: true, retiredAt: true },
      });
      if (!machine) throw notFound('Machine not found');
      if (machine.retiredAt) throw conflict('MASTER_RETIRED', 'Cannot start a job on a retired machine');
      if (machine.stage !== input.stage) throw badRequest('STAGE_MISMATCH', 'Job stage must match the machine stage');
      if (machine.status === 'BREAKDOWN') throw conflict('MACHINE_DAMAGED', 'Cannot start a job on a damaged machine');

      const activeJob = await prisma.stageJob.findFirst({
        where: { machineId: machine.id, status: 'RUNNING' },
        select: { id: true },
      });
      if (activeJob) throw conflict('ACTIVE_JOB', 'This machine already has an active job');

      const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { startedAt: true } });
      if (!order) throw notFound('Order not found');
      const notReady = checkCanStartStage(input.stage, !!order.startedAt, await loggedByStage(input.orderId));
      if (notReady) throw unprocessable(notReady.code, notReady.message, notReady.details);

      const id = actorId(req);
      const createdJob = await prisma.$transaction(async (tx) => {
        const job = await tx.stageJob.create({
          data: { orderId: input.orderId, machineId: input.machineId, stage: input.stage },
          select: { id: true },
        });
        await tx.machine.update({
          where: { id: input.machineId },
          data: { status: 'RUNNING', statusUpdatedById: id, statusUpdatedAt: new Date(), statusNote: null },
        });
        return job;
      });
      return ok(res, { id: machine.id, currentJobId: createdJob.id });
    } catch (err) {
      return next(err);
    }
  },
);

floorRoutes.post(
  '/floor/jobs/:jobId/complete',
  authenticate,
  authorize('OWNER', 'SUPERVISOR'),
  validate({ params: jobParams }),
  async (req, res, next) => {
    try {
      const { jobId } = jobParams.parse(req.params);
      const job = await prisma.stageJob.findUnique({
        where: { id: jobId },
        select: { id: true, machineId: true, status: true },
      });
      if (!job) throw notFound('Production job not found');
      if (job.status !== 'RUNNING') throw conflict('JOB_NOT_ACTIVE', 'This production job is no longer active');

      const updated = await prisma.$transaction(async (tx) => {
        await tx.stageJob.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });
        await tx.machine.update({
          where: { id: job.machineId },
          data: {
            status: 'IDLE',
            statusUpdatedById: actorId(req),
            statusUpdatedAt: new Date(),
            statusNote: null,
          },
        });
        return { id: job.machineId };
      });
      return ok(res, updated);
    } catch (err) {
      return next(err);
    }
  },
);

floorRoutes.get(
  '/floor/logs',
  authenticate,
  authorize('OWNER', 'SUPERVISOR', 'STAFF'),
  validate({ query: logQuery }),
  async (req, res, next) => {
    try {
      const { limit } = logQuery.parse(req.query);
      const staffId = req.authUser?.role === 'STAFF' ? req.authUser.id : undefined;
      const logs = await prisma.productionLog.findMany({
        // Staff only see logs they wrote or logs on machines assigned to them.
        where: staffId ? { OR: [{ createdById: staffId }, { machine: { assignedStaffId: staffId } }] } : {},
        take: limit,
        orderBy: { loggedAt: 'desc' },
        include: {
          order: { select: { orderNo: true } },
          machine: { select: { id: true, code: true, name: true } },
          createdBy: { select: { name: true } },
        },
      });
      return ok(res, logs.map((log) => ({
        id: log.id,
        stageJobId: log.stageJobId,
        orderId: log.orderId,
        orderNumber: log.order.orderNo,
        machineId: log.machineId,
        machineCode: log.machine.code,
        machineName: log.machine.name,
        stage: log.stage,
        shift: log.shift,
        metres: Number(log.metres),
        loggedAt: log.loggedAt.toISOString(),
        createdByName: log.createdBy.name,
        notes: log.notes ?? undefined,
      })));
    } catch (err) {
      return next(err);
    }
  },
);

floorRoutes.post(
  '/floor/logs',
  authenticate,
  authorize('OWNER', 'SUPERVISOR', 'STAFF'),
  validate({ body: productionLogBody }),
  async (req, res, next) => {
    try {
      const input = productionLogBody.parse(req.body);
      if (req.authUser?.role === 'STAFF') {
        const assigned = await prisma.machine.findFirst({
          where: { id: input.machineId, assignedStaffId: req.authUser.id },
          select: { id: true },
        });
        if (!assigned) throw notFound('Assigned machine not found');
      }
      const job = await prisma.stageJob.findFirst({
        where: {
          ...(input.stageJobId ? { id: input.stageJobId } : {}),
          machineId: input.machineId,
          orderId: input.orderId,
          status: 'RUNNING',
        },
        select: { id: true, stage: true },
      });
      if (!job) throw conflict('ACTIVE_JOB_NOT_FOUND', 'No matching active job exists for this machine and order');
      if (job.stage !== input.stage) throw badRequest('STAGE_MISMATCH', 'Production stage does not match the active job');
      if (env.ENFORCE_STAGE_CAP) {
        const overCap = checkStageCap(input.stage, input.metres, await loggedByStage(input.orderId));
        if (overCap) throw unprocessable(overCap.code, overCap.message, overCap.details);
      }

      const log = await prisma.productionLog.create({
        data: {
          stageJobId: job.id,
          machineId: input.machineId,
          orderId: input.orderId,
          stage: input.stage,
          shift: input.shift,
          metres: input.metres,
          notes: input.notes,
          createdById: actorId(req),
        },
        include: {
          order: { select: { orderNo: true } },
          machine: { select: { code: true, name: true } },
          createdBy: { select: { name: true } },
        },
      });
      return ok(res, {
        id: log.id,
        stageJobId: log.stageJobId,
        orderId: log.orderId,
        orderNumber: log.order.orderNo,
        machineId: log.machineId,
        machineCode: log.machine.code,
        machineName: log.machine.name,
        stage: log.stage,
        shift: log.shift,
        metres: Number(log.metres),
        loggedAt: log.loggedAt.toISOString(),
        createdByName: log.createdBy.name,
        notes: log.notes ?? undefined,
      });
    } catch (err) {
      return next(err);
    }
  },
);
