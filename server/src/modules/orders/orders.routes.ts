import { Router } from 'express';
import { ordersController } from './orders.controller';

export const ordersRoutes = Router();

// API-18: POST /orders/feasibility - Preview yarn feasibility without saving
ordersRoutes.post('/feasibility', (req, res, next) => ordersController.previewFeasibility(req, res, next));

// API-19: POST /orders - Create order
ordersRoutes.post('/', (req, res, next) => ordersController.createOrder(req, res, next));

// API-20: GET /orders - List orders
ordersRoutes.get('/', (req, res, next) => ordersController.listOrders(req, res, next));

// API-21: GET /orders/:id - Order detail
ordersRoutes.get('/:id', (req, res, next) => ordersController.getOrder(req, res, next));

// API-22: POST /orders/:id/start - Start production and issue yarn
ordersRoutes.post('/:id/start', (req, res, next) => ordersController.startProduction(req, res, next));
