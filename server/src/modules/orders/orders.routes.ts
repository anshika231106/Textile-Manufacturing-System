import { Router } from 'express';
import { z } from 'zod';
import { ordersController } from './orders.controller';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';

export const ordersRoutes = Router();

// API-18: POST /orders/feasibility - Preview yarn feasibility without saving
ordersRoutes.post(
  '/feasibility',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  (req, res, next) => ordersController.previewFeasibility(req, res, next)
);

// API-19: POST /orders - Create order
ordersRoutes.post(
  '/',
  authenticate,
  authorize('OWNER', 'OFFICE'),
  (req, res, next) => ordersController.createOrder(req, res, next)
);

// API-20: GET /orders - List orders
ordersRoutes.get(
  '/',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  (req, res, next) => ordersController.listOrders(req, res, next)
);

// API-21: GET /orders/:id - Order detail
ordersRoutes.get(
  '/:id',
  authenticate,
  authorize('OWNER', 'OFFICE', 'SUPERVISOR'),
  (req, res, next) => ordersController.getOrder(req, res, next)
);

// API-22: POST /orders/:id/start - Start production and issue yarn
ordersRoutes.post(
  '/:id/start',
  authenticate,
  authorize('OWNER', 'OFFICE'),
  (req, res, next) => ordersController.startProduction(req, res, next)
);

// DELETE /orders/:id - Delete an order that has not started production
ordersRoutes.delete(
  '/:id',
  authenticate,
  authorize('OWNER', 'OFFICE'),
  validate({ params: z.object({ id: z.string().uuid('Invalid ID format') }) }),
  (req, res, next) => ordersController.deleteOrder(req, res, next)
);
