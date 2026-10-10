import type { Request, Response, NextFunction } from 'express';
import { created, ok } from '../../lib/respond';
import { unauthenticated } from '../../lib/httpErrors';
import { ordersService } from './orders.service';
import {
  FeasibilitySchema,
  CreateOrderSchema,
  ListOrdersQuerySchema,
} from './orders.schemas';

function requireUserId(req: Request): string {
  const userId = req.authUser?.id;
  if (!userId) throw unauthenticated();
  return userId;
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
      const userId = requireUserId(req);
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
        data: result,
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
      const userId = requireUserId(req);
      const result = await ordersService.startProduction(req.params.id, userId);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }

  async deleteOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ordersService.deleteOrder(req.params.id);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const ordersController = new OrdersController();
