import type { Request, Response, NextFunction } from 'express';
import { created, ok } from '../../lib/respond';
import { unauthenticated } from '../../lib/httpErrors';
import { stockService } from './stock.service';
import {
  CreateReceiptSchema,
  StockLedgerQuerySchema,
  FinishedStockQuerySchema,
} from './stock.schemas';

function requireUserId(req: Request): string {
  const userId = req.authUser?.id;
  if (!userId) throw unauthenticated();
  return userId;
}

export class StockController {
  async recordReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateReceiptSchema.parse(req.body);
      const userId = requireUserId(req);
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
