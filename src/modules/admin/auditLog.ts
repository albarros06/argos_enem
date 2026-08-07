import type { AdminActionType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | PrismaClient;

export interface AuditEntry {
  id: string;
  action: AdminActionType;
  amount: number | null;
  reason: string | null;
  adminEmail: string;
  createdAt: Date;
}

type LoggedEntry = Prisma.AdminActionLogGetPayload<{
  include: { admin: { select: { email: true } } };
}>;

function toAuditEntry(entry: LoggedEntry): AuditEntry {
  return {
    id: entry.id,
    action: entry.action,
    amount: entry.amount,
    reason: entry.reason,
    adminEmail: entry.admin.email,
    createdAt: entry.createdAt,
  };
}

export async function recordAdminAction(
  adminId: string,
  action: AdminActionType,
  targetUserId: string,
  amount: number | null,
  reason: string | null,
  db: Db = prisma,
): Promise<AuditEntry> {
  const entry = await db.adminActionLog.create({
    data: { adminId, action, targetUserId, amount, reason },
    include: { admin: { select: { email: true } } },
  });
  return toAuditEntry(entry);
}

export async function listActionsForUser(targetUserId: string): Promise<AuditEntry[]> {
  const entries = await prisma.adminActionLog.findMany({
    where: { targetUserId },
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { email: true } } },
  });
  return entries.map(toAuditEntry);
}
