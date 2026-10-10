import { Router } from 'express';
import { prisma } from './db/prisma';
import { authRoutes } from './modules/auth/auth.routes';
import { mastersRoutes } from './modules/masters/masters.routes';
import { stockRoutes } from './modules/stock/stock.routes';
import { ordersRoutes } from './modules/orders/orders.routes';
import { floorRoutes } from './modules/floor/floor.routes';
import { rollsRoutes } from './modules/rolls/rolls.routes';
import { dispatchRoutes } from './modules/dispatch/dispatch.routes';
import { invoicesRoutes } from './modules/invoices/invoices.routes';
import { attendanceRoutes } from './modules/attendance/attendance.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { publicRoutes } from './modules/public/public.routes';
import { staffRoutes } from './modules/staff/staff.routes';

export const router = Router();

// API-03: public liveness + database check. Registered with no auth middleware.
router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ data: { status: 'ok', db: 'ok', time: new Date().toISOString() } });
  } catch (err: any) {
    console.error('Health check DB error:', err);
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not reachable' } });
  }
});

// One mount line per module (all created now so later tasks never edit this file).
// Modules whose routes cross prefixes (e.g. /orders/:id/stage-jobs in floor,
// /stock/finished in dispatch) are mounted at '/' and declare their full paths.
router.use('/auth', authRoutes);
router.use('/orders', ordersRoutes);
router.use('/reports', reportsRoutes);
router.use('/public', publicRoutes);
router.use(mastersRoutes);
router.use(stockRoutes);
router.use(floorRoutes);
router.use(rollsRoutes);
router.use(dispatchRoutes);
router.use(invoicesRoutes);
router.use(attendanceRoutes);
router.use(staffRoutes);
