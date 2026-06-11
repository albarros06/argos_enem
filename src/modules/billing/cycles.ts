import type { Prisma, Subscription, SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { business } from "@/lib/config";
import { logger } from "@/lib/logger";
import { cycleIdFor, expireQuota, grantQuota } from "@/modules/credits";

// Abre um novo ciclo mensal: expira a cota não usada do ciclo anterior
// (sem rollover — FR-022) e concede a cota do plano no novo ciclo.
export async function openNewCycle(
  subscription: Subscription,
  plan: SubscriptionPlan,
  tx: Prisma.TransactionClient,
): Promise<{ periodStart: Date; periodEnd: Date }> {
  const previousCycleId = cycleIdFor(subscription.id, subscription.currentPeriodStart);
  await expireQuota(subscription.userId, previousCycleId, tx);

  const periodStart = new Date();
  const periodEnd = addMonths(periodStart, 1);
  await tx.subscription.update({
    where: { id: subscription.id },
    data: { status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
  });
  await grantQuota(
    subscription.userId,
    plan.monthlyQuota,
    cycleIdFor(subscription.id, periodStart),
    tx,
  );
  return { periodStart, periodEnd };
}

// Varredura horária: ciclos vencidos perdem a cota restante; assinaturas canceladas
// ou com carência esgotada revertem ao estado gratuito (FR-022, FR-025, edge case
// de renovação falha com período de carência).
export async function sweepBillingCycles(): Promise<void> {
  const now = new Date();
  const ended = await prisma.subscription.findMany({
    where: { currentPeriodEnd: { lt: now }, status: { in: ["active", "past_due", "canceled"] } },
  });

  for (const subscription of ended) {
    await expireQuota(
      subscription.userId,
      cycleIdFor(subscription.id, subscription.currentPeriodStart),
    );

    if (subscription.status === "canceled") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "expired" },
      });
      continue;
    }

    const graceEnd = new Date(
      subscription.currentPeriodEnd.getTime() + business.gracePeriodDays * 24 * 60 * 60 * 1000,
    );
    if (now > graceEnd) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "expired" },
      });
    } else if (subscription.status === "active") {
      // Renovação ainda não confirmada — entra em carência, avisado no app.
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "past_due" },
      });
    }
  }
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export function startBillingSweep(): NodeJS.Timeout {
  const timer = setInterval(() => {
    sweepBillingCycles().catch((error) => {
      logger.error("billing_sweep_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
