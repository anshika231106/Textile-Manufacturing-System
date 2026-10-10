import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthenticated, forbidden } from '../lib/httpErrors';
import type { Role } from '../../generated/prisma/client';

export interface AuthJwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export const requireAuth =
  (allowedRoles?: Role[]): RequestHandler =>
  (req: any, _res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(unauthenticated('Authorization header missing or invalid'));
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return next(unauthenticated('Token missing'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        return next(forbidden(`Role ${decoded.role} not authorized for this resource`));
      }
      req.user = decoded;
      next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return next(unauthenticated('Session expired. Please log in again.'));
      }
      return next(unauthenticated('Invalid token'));
    }
  };
