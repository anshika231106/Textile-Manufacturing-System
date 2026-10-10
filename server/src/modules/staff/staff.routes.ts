import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/authenticate';
import {
  createStaffService,
  listStaffService,
  deleteStaffService,
  updateStaffRoleService,
} from './staff.service';
import { ok, created } from '../../lib/respond';

export const staffRoutes = Router();

// Only OFFICE and OWNER are authorized to view and manage staff
const STAFF_ADMIN_ROLES = ['OFFICE', 'OWNER'] as const;

// GET /api/v1/staff
staffRoutes.get(
  '/staff',
  authenticate,
  authorize(...STAFF_ADMIN_ROLES),
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
  authenticate,
  authorize(...STAFF_ADMIN_ROLES),
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

// PATCH /api/v1/staff/:id/role - only owners can change roles
staffRoutes.patch(
  '/staff/:id/role',
  authenticate,
  authorize('OWNER'),
  validate({
    params: z.object({
      id: z.string().uuid('Invalid staff ID format'),
    }),
    body: z.object({
      role: z.enum(['OFFICE', 'SUPERVISOR', 'STAFF'], {
        message: 'Role must be OFFICE, SUPERVISOR, or STAFF',
      }),
    }),
  }),
  async (req, res, next) => {
    try {
      const updatedStaff = await updateStaffRoleService(
        req.params.id,
        req.body.role,
        req.authUser!.id,
      );
      return ok(res, updatedStaff);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/staff/:id
staffRoutes.delete(
  '/staff/:id',
  authenticate,
  authorize(...STAFF_ADMIN_ROLES),
  validate({
    params: z.object({
      id: z.string().uuid('Invalid staff ID format'),
    }),
  }),
  async (req, res, next) => {
    try {
      const result = await deleteStaffService(req.params.id, req.authUser!.id);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }
);
