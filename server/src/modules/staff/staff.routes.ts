import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import {
  createStaffService,
  listStaffService,
  deleteStaffService,
} from './staff.service';
import { ok, created } from '../../lib/respond';

export const staffRoutes = Router();

// Only OFFICE and OWNER are authorized to view and manage staff
const STAFF_ADMIN_ROLES = ['OFFICE', 'OWNER'] as const;

// GET /api/v1/staff
staffRoutes.get(
  '/staff',
  requireAuth([...STAFF_ADMIN_ROLES]),
  async (_req, res, next) => {
    try {
      const staffList = await listStaffService();
      return ok(res, staffList);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/staff
staffRoutes.post(
  '/staff',
  requireAuth([...STAFF_ADMIN_ROLES]),
  validate({
    body: z.object({
      name: z.string().min(1, 'Name is required').max(120),
      email: z.string().email('Valid email is required'),
      role: z.enum(['OFFICE', 'SUPERVISOR', 'STAFF'], {
        message: 'Role must be OFFICE, SUPERVISOR, or STAFF',
      }),
    }),
  }),
  async (req, res, next) => {
    try {
      const newStaff = await createStaffService(req.body);
      return created(res, newStaff);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/staff/:id
staffRoutes.delete(
  '/staff/:id',
  requireAuth([...STAFF_ADMIN_ROLES]),
  validate({
    params: z.object({
      id: z.string().uuid('Invalid staff ID format'),
    }),
  }),
  async (req: any, res, next) => {
    try {
      const result = await deleteStaffService(req.params.id, req.user.sub);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }
);
