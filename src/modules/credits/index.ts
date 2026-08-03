import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { business } from "@/lib/config";

type Db = Prisma.TransactionClient | PrismaClient;

export interface CreditBalance {
  freeRemaining: number;
  quotaRemaining: number;
  cycleEndsAt: Date | null;
}

export class InsufficientCreditsError extends ApiError {
  constructor() {
    super("PAYWALL", 402, "Você não tem créditos disponíveis. Assine um plano para continuar.");
  }
}

export function cycleIdFor(subscriptionId: string, periodStart: Date): string {
  return `${subscriptionId}:${periodStart.toISOString()}`;
}

// Ciclo mensal do crédito gratuito, alinhado ao mês-calendário UTC (não à data
// de cadastro do usuário) — ex.: "free:2026-08". Todo saldo/consumo do free
// tier é somado dentro desse cycleId, então o crédito não usado não acumula
// para o mês seguinte (mesma regra de não-rollover da cota paga, FR-022).
export function freeCycleId(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `free:${year}-${month}`;
}

// Garante que o usuário já recebeu o crédito gratuito do mês-calendário
// corrente — idempotente (checa antes de inserir), chamada tanto no cadastro
// quanto sob demanda (getBalance/consumeCredit) para cobrir usuários que já
// existiam antes da virada do mês.
export async function ensureFreeMonthlyCredit(userId: string, db: Db = prisma) {
  const cycleId = freeCycleId();
  const existing = await db.creditTransaction.findFirst({
    where: { userId, kind: "monthly_free_grant", cycleId },
  });
  if (existing) {
    return;
  }
  await db.creditTransaction.create({
    data: { userId, amount: business.freeMonthlyCredits, kind: "monthly_free_grant", cycleId },
  });
}

// Concessão manual (operacional/admin): soma direto no freeRemaining do mês
// corrente. Registrado com kind próprio para auditoria.
export async function grantManualCredits(userId: string, amount: number, db: Db = prisma) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Quantidade de créditos inválida: ${amount} (esperado inteiro positivo)`);
  }
  await db.creditTransaction.create({
    data: { userId, amount, kind: "manual_grant", cycleId: freeCycleId() },
  });
}

export async function grantQuota(userId: string, amount: number, cycleId: string, db: Db = prisma) {
  await db.creditTransaction.create({ data: { userId, amount, kind: "quota_grant", cycleId } });
}

// Inserts the offsetting entry so unused quota nets to zero (no rollover — FR-022).
export async function expireQuota(userId: string, cycleId: string, db: Db = prisma) {
  const unused = await sumLedger(db, userId, cycleId);
  if (unused > 0) {
    await db.creditTransaction.create({
      data: { userId, amount: -unused, kind: "quota_expiry", cycleId },
    });
  }
}

// The advisory lock also serializes against consumeCredit, so a concurrent
// grant-check + consume can't double-grant or double-spend the monthly credit.
export async function getBalance(userId: string): Promise<CreditBalance> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    await ensureFreeMonthlyCredit(userId, tx);
    return computeBalance(tx, userId);
  });
}

// Consumes one credit atomically — quota first, then free (data-model rule).
// The per-user advisory lock serializes concurrent submissions.
export async function consumeCredit(userId: string, submissionId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    await ensureFreeMonthlyCredit(userId, tx);
    const balance = await computeBalance(tx, userId);
    if (balance.quotaRemaining > 0) {
      const cycle = await currentCycle(tx, userId);
      await tx.creditTransaction.create({
        data: { userId, amount: -1, kind: "consume", submissionId, cycleId: cycle?.cycleId },
      });
      return { from: "quota" as const };
    }
    if (balance.freeRemaining > 0) {
      await tx.creditTransaction.create({
        data: { userId, amount: -1, kind: "consume", submissionId, cycleId: freeCycleId() },
      });
      return { from: "free" as const };
    }
    throw new InsufficientCreditsError();
  });
}

// Idempotent: at most one refund per consumed submission (FR-015).
export async function refundCredit(userId: string, submissionId: string) {
  const consumed = await prisma.creditTransaction.findFirst({
    where: { userId, submissionId, kind: "consume" },
    orderBy: { createdAt: "desc" },
  });
  if (!consumed) {
    return;
  }
  const alreadyRefunded = await prisma.creditTransaction.findFirst({
    where: { userId, submissionId, kind: "refund" },
  });
  if (alreadyRefunded) {
    return;
  }
  await prisma.creditTransaction.create({
    data: { userId, amount: 1, kind: "refund", submissionId, cycleId: consumed.cycleId },
  });
}

async function currentCycle(db: Db, userId: string) {
  const subscription = await db.subscription.findUnique({ where: { userId } });
  if (!subscription) {
    return null;
  }
  const accessibleStatuses = ["active", "past_due", "canceled"];
  const withinPeriod = new Date() < subscription.currentPeriodEnd;
  if (!accessibleStatuses.includes(subscription.status) || !withinPeriod) {
    return null;
  }
  return {
    cycleId: cycleIdFor(subscription.id, subscription.currentPeriodStart),
    endsAt: subscription.currentPeriodEnd,
  };
}

async function computeBalance(db: Db, userId: string): Promise<CreditBalance> {
  const cycle = await currentCycle(db, userId);
  const freeRemaining = await sumLedger(db, userId, freeCycleId());
  const quotaRemaining = cycle ? await sumLedger(db, userId, cycle.cycleId) : 0;
  return { freeRemaining, quotaRemaining, cycleEndsAt: cycle?.endsAt ?? null };
}

async function sumLedger(db: Db, userId: string, cycleId: string | null): Promise<number> {
  const result = await db.creditTransaction.aggregate({
    _sum: { amount: true },
    where: { userId, cycleId },
  });
  return result._sum.amount ?? 0;
}
