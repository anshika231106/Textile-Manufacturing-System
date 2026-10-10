import type { RequestHandler } from 'express';
import jwt, { JsonWebTokenError, type SignOptions } from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { forbidden, unauthenticated } from '../lib/httpErrors';
import type { Role } from '../../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return next(unauthenticated());

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err instanceof JsonWebTokenError) return next(unauthenticated());
    return next(err);
  }

  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    return next(unauthenticated());
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return next(unauthenticated());
    req.authUser = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.authUser) return next(unauthenticated());
    if (!roles.includes(req.authUser.role)) return next(forbidden());
    return next();
  };

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}
