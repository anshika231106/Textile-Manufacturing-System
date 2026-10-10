import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { AppError, unauthenticated } from '../../lib/httpErrors';
import type { Role } from '../../../generated/prisma/client';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthTokens {
  token: string; // backwards compatibility alias for accessToken
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return rawToken;
}

export async function loginService(email: string, password: string): Promise<AuthTokens> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  const refreshToken = await createRefreshToken(user.id);

  const userSummary: UserSummary = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: userSummary,
  };
}

export async function refreshService(rawRefreshToken: string): Promise<AuthTokens> {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    throw unauthenticated('Refresh token required');
  }

  const tokenHash = hashToken(rawRefreshToken.trim());
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  // Token reuse detection: if token exists but was already revoked, revoke all tokens for safety
  if (stored && stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthenticated('Refresh token already used or revoked. Please log in again.');
  }

  if (!stored) {
    throw unauthenticated('Invalid refresh token');
  }

  if (stored.expiresAt < new Date()) {
    throw unauthenticated('Refresh token expired. Please log in again.');
  }

  // Revoke old refresh token (Token Rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  // Issue new refresh token
  const newRefreshToken = await createRefreshToken(stored.userId);

  // Issue new access token
  const accessToken = jwt.sign(
    { sub: stored.user.id, email: stored.user.email, role: stored.user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  return {
    token: accessToken,
    accessToken,
    refreshToken: newRefreshToken,
    user: stored.user,
  };
}

export async function logoutService(rawRefreshToken?: string, userId?: string): Promise<{ success: boolean }> {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken.trim());
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } else if (userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return { success: true };
}

export async function getMeService(userId: string): Promise<UserSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw unauthenticated('User not found');
  }

  return user;
}

