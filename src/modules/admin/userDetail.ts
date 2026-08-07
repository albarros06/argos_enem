import { prisma } from "@/lib/prisma";
import { getBalance, type CreditBalance } from "@/modules/credits";
import { listActionsForUser, type AuditEntry } from "./auditLog";

export interface UserDetail {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    role: string;
  };
  submissions: {
    id: string;
    themeText: string;
    status: string;
    totalScore: number | null;
    createdAt: Date;
  }[];
  creditBalance: CreditBalance;
  creditTransactions: {
    id: string;
    amount: number;
    kind: string;
    cycleId: string | null;
    createdAt: Date;
  }[];
  subscription: {
    tier: string;
    planName: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  } | null;
  auditHistory: AuditEntry[];
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      createdAt: true,
      role: true,
    },
  });
  if (!user) {
    return null;
  }

  const [submissions, creditBalance, creditTransactions, subscription, auditHistory] =
    await Promise.all([
      prisma.submission.findMany({
        where: { userId },
        select: {
          id: true,
          themeText: true,
          status: true,
          createdAt: true,
          evaluation: { select: { totalScore: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      getBalance(userId),
      prisma.creditTransaction.findMany({
        where: { userId },
        select: { id: true, amount: true, kind: true, cycleId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: {
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          plan: { select: { tier: true, name: true } },
        },
      }),
      listActionsForUser(userId),
    ]);

  return {
    user,
    submissions: submissions.map((submission) => ({
      id: submission.id,
      themeText: submission.themeText,
      status: submission.status,
      totalScore: submission.evaluation?.totalScore ?? null,
      createdAt: submission.createdAt,
    })),
    creditBalance,
    creditTransactions,
    subscription: subscription
      ? {
          tier: subscription.plan.tier,
          planName: subscription.plan.name,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
    auditHistory,
  };
}
