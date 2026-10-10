import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpErrors';
import { ok } from '../../lib/respond';
import { authenticate, authorize } from '../../middleware/authenticate';

export const rollsRoutes = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /rolls/:id/trace (and /rolls/:id) - API-33 (US-15 / P1)
 * Full roll genealogy: Order, Yarn Issued, Machines, Shift Logs, QC verdicts, Dispatch & Invoice
 */
rollsRoutes.get(
  ['/rolls/:id/trace', '/rolls/:id'],
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const cleanId = id.trim();
      const isUuid = UUID_REGEX.test(cleanId);

      const roll = await prisma.roll.findFirst({
        where: isUuid
          ? { OR: [{ id: cleanId }, { rollNo: { equals: cleanId, mode: 'insensitive' } }] }
          : { rollNo: { equals: cleanId, mode: 'insensitive' } },
        include: {
          order: {
            include: {
              buyer: true,
              requirements: {
                include: { yarnType: true },
              },
              movements: {
                where: { type: 'ISSUE' },
                include: {
                  yarnType: true,
                  createdBy: { select: { id: true, name: true } },
                },
                orderBy: { occurredAt: 'asc' },
              },
              stageJobs: {
                include: {
                  machine: true,
                  logs: {
                    include: {
                      createdBy: { select: { id: true, name: true } },
                    },
                    orderBy: { loggedAt: 'asc' },
                  },
                },
                orderBy: { startedAt: 'asc' },
              },
            },
          },
          weavingMachine: true,
          dyeingMachine: true,
          createdBy: { select: { id: true, name: true, role: true } },
          qcRecords: {
            include: {
              inspector: { select: { id: true, name: true } },
            },
            orderBy: { checkedAt: 'asc' },
          },
          dispatchItem: {
            include: {
              dispatch: {
                include: {
                  createdBy: { select: { id: true, name: true } },
                  invoice: {
                    include: {
                      payments: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!roll) {
        throw notFound(`Roll "${cleanId}" not found in manufacturing records`);
      }

      // Flatten production logs across stages for this order
      const productionLogs = roll.order.stageJobs.flatMap((job) =>
        job.logs.map((log) => ({
          id: log.id,
          stageJobId: job.id,
          stage: log.stage,
          shift: log.shift,
          metres: Number(log.metres),
          machineId: job.machineId,
          machineCode: job.machine.code,
          machineName: job.machine.name,
          loggedAt: log.loggedAt.toISOString(),
          operatorName: log.createdBy.name,
          notes: log.notes ?? undefined,
        }))
      );

      const rawInvoice = roll.dispatchItem?.dispatch?.invoice;
      let invoicePayload = null;
      if (rawInvoice) {
        const totalPaid = (rawInvoice.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const invAmount = Number(rawInvoice.amount);
        const invoiceStatus = totalPaid >= invAmount ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';
        invoicePayload = {
          id: rawInvoice.id,
          invoiceNo: rawInvoice.invoiceNo,
          amount: invAmount,
          paidAmount: totalPaid,
          status: invoiceStatus,
          issuedAt: rawInvoice.issuedAt.toISOString(),
        };
      }

      const dispatchInfo = roll.dispatchItem?.dispatch
        ? {
            id: roll.dispatchItem.dispatch.id,
            dispatchNo: roll.dispatchItem.dispatch.dispatchNo,
            vehicleNo: roll.dispatchItem.dispatch.vehicleNo ?? undefined,
            dispatchedAt: roll.dispatchItem.dispatch.dispatchedAt.toISOString(),
            dispatchedByName: roll.dispatchItem.dispatch.createdBy.name,
            invoice: invoicePayload,
          }
        : null;

      const tracePayload = {
        roll: {
          id: roll.id,
          rollNo: roll.rollNo,
          metres: Number(roll.metres),
          status: roll.status,
          createdAt: roll.createdAt.toISOString(),
          weavingMachine: {
            id: roll.weavingMachine.id,
            code: roll.weavingMachine.code,
            name: roll.weavingMachine.name,
            stage: roll.weavingMachine.stage,
          },
          dyeingMachine: {
            id: roll.dyeingMachine.id,
            code: roll.dyeingMachine.code,
            name: roll.dyeingMachine.name,
            stage: roll.dyeingMachine.stage,
          },
          createdBy: {
            id: roll.createdBy.id,
            name: roll.createdBy.name,
            role: roll.createdBy.role,
          },
        },
        order: {
          id: roll.order.id,
          orderNo: roll.order.orderNo,
          buyer: {
            id: roll.order.buyer.id,
            name: roll.order.buyer.name,
            contactName: roll.order.buyer.contactName ?? undefined,
            phone: roll.order.buyer.phone ?? undefined,
          },
          fabricType: roll.order.fabricType,
          colour: roll.order.colour,
          metres: Number(roll.order.metres),
          ratePerMetre: Number(roll.order.ratePerMetre),
          deadline: roll.order.deadline.toISOString().slice(0, 10),
          startedAt: roll.order.startedAt?.toISOString() ?? null,
          trackingToken: roll.order.trackingToken,
          requirements: roll.order.requirements.map((req) => ({
            yarnTypeId: req.yarnTypeId,
            yarnCode: req.yarnType.code,
            yarnName: req.yarnType.name,
            colour: req.yarnType.colour,
            kgPerMetre: Number(req.kgPerMetre),
          })),
        },
        yarnIssued: roll.order.movements.map((m) => ({
          id: m.id,
          yarnTypeId: m.yarnTypeId,
          yarnCode: m.yarnType.code,
          yarnName: m.yarnType.name,
          colour: m.yarnType.colour,
          kg: Number(m.kg),
          ratePerKg: Number(m.ratePerKg),
          totalCost: Number(m.kg) * Number(m.ratePerKg),
          reference: m.reference ?? undefined,
          occurredAt: m.occurredAt.toISOString(),
          issuedByName: m.createdBy.name,
        })),
        stageJobs: roll.order.stageJobs.map((j) => ({
          id: j.id,
          stage: j.stage,
          machineId: j.machine.id,
          machineCode: j.machine.code,
          machineName: j.machine.name,
          status: j.status,
          startedAt: j.startedAt.toISOString(),
          endedAt: j.endedAt?.toISOString() ?? null,
          isWeavingMachineForThisRoll: j.machineId === roll.weavingMachineId,
          isDyeingMachineForThisRoll: j.machineId === roll.dyeingMachineId,
        })),
        productionLogs,
        qcHistory: roll.qcRecords.map((q) => ({
          id: q.id,
          result: q.result,
          defectType: q.defectType ?? undefined,
          notes: q.notes ?? undefined,
          checkedAt: q.checkedAt.toISOString(),
          inspector: {
            id: q.inspector.id,
            name: q.inspector.name,
          },
        })),
        dispatch: dispatchInfo,
      };

      return ok(res, tracePayload);
    } catch (err) {
      next(err);
    }
  }
);
