import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { created, ok } from '../../lib/respond';
import { stockService } from './stock.service';
import {
  CreateReceiptSchema,
  StockLedgerQuerySchema,
  FinishedStockQuerySchema,
} from './stock.schemas';

async function resolveAuditUserId(req: Request): Promise<string> {
  if ((req as any).user?.id) {
    return (req as any).user.id;
  }
  const fallback = await prisma.user.findFirst({
    where: { role: { in: ['SUPERVISOR', 'OWNER', 'OFFICE'] } },
    select: { id: true },
  });
  if (fallback) return fallback.id;
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  return anyUser?.id || '00000000-0000-0000-0000-000000000001';
}

export class StockController {
  async recordReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateReceiptSchema.parse(req.body);
      const userId = await resolveAuditUserId(req);
      const result = await stockService.recordReceipt(input, userId);
      return created(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getStockSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await stockService.getStockSummary();
      return ok(res, summary);
    } catch (err) {
      next(err);
    }
  }

  async getStockLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const query = StockLedgerQuerySchema.parse(req.query);
      const result = await stockService.getStockLedger(query);
      return res.status(200).json({
        data: result,
        items: result.items,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async getFinishedStock(req: Request, res: Response, next: NextFunction) {
    try {
      const query = FinishedStockQuerySchema.parse(req.query);
      const result = await stockService.getFinishedStock(query);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const stockController = new StockController();
