import { Router } from 'express';
import { stockController } from './stock.controller';

export const stockRoutes = Router();

// API-14: POST /stock/receipts - Record a yarn receipt
stockRoutes.post('/stock/receipts', (req, res, next) => stockController.recordReceipt(req, res, next));

// API-15: GET /stock/summary - Yarn stock balances and low-stock indicators
stockRoutes.get('/stock/summary', (req, res, next) => stockController.getStockSummary(req, res, next));

// API-16: GET /stock/ledger - Yarn ledger audit trail
stockRoutes.get('/stock/ledger', (req, res, next) => stockController.getStockLedger(req, res, next));

// API-17: GET /stock/finished - Finished fabric stock on shelf vs dispatched
stockRoutes.get('/stock/finished', (req, res, next) => stockController.getFinishedStock(req, res, next));
