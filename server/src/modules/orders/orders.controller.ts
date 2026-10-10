import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { created, ok } from '../../lib/respond';
import { ordersService } from './orders.service';
import {
  FeasibilitySchema,
  CreateOrderSchema,
  ListOrdersQuerySchema,
} from './orders.schemas';

async function resolveAuditUserId(req: Request): Promise<string> {
  if ((req as any).user?.id) {
    return (req as any).user.id;
  }
  const fallback = await prisma.user.findFirst({
    where: { role: { in: ['OFFICE', 'OWNER'] } },
    select: { id: true },
  });
  if (fallback) return fallback.id;
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  return anyUser?.id || '00000000-0000-0000-0000-000000000001';
}

export class OrdersController {
  async previewFeasibility(req: Request, res: Response, next: NextFunction) {
    try {
      const input = FeasibilitySchema.parse(req.body);
      const result = await ordersService.previewFeasibility(input);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateOrderSchema.parse(req.body);
      const userId = await resolveAuditUserId(req);
      const result = await ordersService.createOrder(input, userId);
      return created(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const query = ListOrdersQuerySchema.parse(req.query);
      const result = await ordersService.listOrders(query);
      return res.status(200).json({
        data: result.items,
        items: result.items,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ordersService.getOrder(req.params.id);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }

  async startProduction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = await resolveAuditUserId(req);
      const result = await ordersService.startProduction(req.params.id, userId);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const ordersController = new OrdersController();
