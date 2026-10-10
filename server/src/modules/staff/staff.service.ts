import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { conflict, notFound, badRequest } from '../../lib/httpErrors';
import { sendWelcomeEmail } from '../../lib/mailer';
import type { Role } from '../../../generated/prisma/client';

function generateRandomPassword(length = 10): string {
  // Generates clean alphanumeric password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  role: Role;
  customPassword?: string;
}

export async function createStaffService(data: CreateStaffInput) {
  const normalizedEmail = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw conflict('CONFLICT_DUPLICATE', `User with email "${normalizedEmail}" already exists`);
  }

  const plainPassword = data.customPassword && data.customPassword.trim().length > 0
    ? data.customPassword.trim()
    : generateRandomPassword(10);

  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const newUser = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: normalizedEmail,
      role: data.role,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // Send credentials email asynchronously (does not block user creation if SMTP is slow/fails)
  sendWelcomeEmail({
    to: newUser.email,
    name: newUser.name,
    role: newUser.role,
    password: plainPassword,
  }).catch((err) => {
    console.error(`Error sending email to ${newUser.email}:`, err);
  });

  return newUser;
}

export async function listStaffService() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return users;
}

export async function deleteStaffService(id: string, currentUserId: string) {
  if (id === currentUserId) {
    throw badRequest('CANNOT_DELETE_SELF', 'You cannot delete your own account');
  }

  const target = await prisma.user.findUnique({
    where: { id },
  });

  if (!target) {
    throw notFound('Staff member not found');
  }

  await prisma.user.delete({
    where: { id },
  });

  return { success: true, id };
}
