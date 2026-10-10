import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loginService, getMeService } from './auth.service';
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

// GET /api/v1/auth/me
authRoutes.get('/me', requireAuth(), async (req: any, res, next) => {
  try {
    console.log("fsdfsdfjdd")
    const user = await getMeService(req.user.sub);
    return ok(res, user);
  } catch (err) {
    next(err);
  }
});
