import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { conflict, notFound, badRequest } from '../../lib/httpErrors';
import { sendWelcomeEmail } from '../../lib/mailer';
import { isSalariedRole, plantDateValue } from '../../lib/payroll';
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

  if (existing && !existing.deletedAt) {
    throw conflict('CONFLICT_DUPLICATE', `User with email "${normalizedEmail}" already exists`);
  }

  const plainPassword = data.customPassword && data.customPassword.trim().length > 0
    ? data.customPassword.trim()
    : generateRandomPassword(10);

  const passwordHash = await bcrypt.hash(plainPassword, 12);
  const salaryStartDate = isSalariedRole(data.role) ? plantDateValue(new Date()) : null;

  const select = {
    id: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
  } as const;

  // A previously removed employee is restored so their history stays linked.
  const newUser = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: data.name.trim(), role: data.role, passwordHash, salaryStartDate, deletedAt: null },
        select,
      })
    : await prisma.user.create({
        data: {
          name: data.name.trim(),
          email: normalizedEmail,
          role: data.role,
          passwordHash,
          salaryStartDate,
        },
        select,
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
    where: { deletedAt: null },
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

  if (!target || target.deletedAt) {
    throw notFound('Staff member not found');
  }
  if (target.role === 'OWNER') {
    throw badRequest('CANNOT_DELETE_OWNER', 'Owner accounts cannot be removed');
  }

  // Soft delete: attendance, wages, production and dispatch records reference
  // this user, so a hard delete would violate foreign keys.
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: now } }),
    prisma.machine.updateMany({ where: { assignedStaffId: id }, data: { assignedStaffId: null } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } }),
  ]);

  return { success: true, id };
}

export async function updateStaffRoleService(id: string, role: Role, currentUserId: string) {
  if (id === currentUserId) {
    throw badRequest('CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true },
  });

  if (!target || target.deletedAt) {
    throw notFound('Staff member not found');
  }
  if (target.role === 'OWNER') {
    throw badRequest('CANNOT_CHANGE_OWNER_ROLE', 'Owner roles cannot be changed');
  }
  if (target.role === role) {
    throw badRequest('ROLE_UNCHANGED', 'The user already has this role');
  }
  const roleRank: Partial<Record<Role, number>> = {
    STAFF: 0,
    SUPERVISOR: 1,
    OFFICE: 2,
  };
  const currentRank = roleRank[target.role];
  const requestedRank = roleRank[role];
  if (currentRank === undefined || requestedRank !== currentRank + 1) {
    throw badRequest(
      'ROLE_MUST_BE_UPGRADED',
      'Roles can only be upgraded one level at a time: Staff, Supervisor, then Office',
    );
  }

  // Staff → Supervisor moves from daily wages to a salary from today;
  // Supervisor → Office keeps the original salary start date.
  const promotion = await prisma.user.updateMany({
    where: { id, role: target.role },
    data: {
      role,
      ...(target.role === 'STAFF' ? { salaryStartDate: plantDateValue(new Date()) } : {}),
    },
  });
  if (promotion.count !== 1) {
    throw conflict('ROLE_CHANGED_CONCURRENTLY', 'The employee role changed. Refresh and try again.');
  }

  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}
