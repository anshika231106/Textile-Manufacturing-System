import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loginService, getMeService, refreshService, logoutService } from './auth.service';
import { ok } from '../../lib/respond';

export const authRoutes = Router();

// POST /api/v1/auth/login
authRoutes.post(
  '/login',
  validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const result = await loginService(req.body.email, req.body.password);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh
authRoutes.post(
  '/refresh',
  validate({
    body: z.object({
      refreshToken: z.string().min(1, 'Refresh token is required'),
    }),
  }),
  async (req, res, next) => {
    try {
      const result = await refreshService(req.body.refreshToken);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/logout
authRoutes.post(
  '/logout',
  validate({
    body: z.object({
      refreshToken: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await logoutService(req.body?.refreshToken);
      return ok(res, { success: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/auth/me
authRoutes.get('/me', requireAuth(), async (req: any, res, next) => {
  try {
    const user = await getMeService(req.user.sub);
    return ok(res, user);
  } catch (err) {
    next(err);
  }
});

