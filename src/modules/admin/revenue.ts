import { prisma } from "@/lib/prisma";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";

export interface RevenueSummary {
  mrrCents: number;
  subscribersByTierAndStatus: { tier: PlanTier; status: SubscriptionStatus; count: number }[];
  recentPayments: {
    id: string;
    amountCents: number;
    method: string;
    status: string;
    userEmail: string | null;
    createdAt: Date;
  }[];
}

const RECENT_PAYMENTS_LIMIT = 20;

// MRR = soma do preço do plano de toda assinatura com status "active" — sem
// modelagem de proração/desconto (definição fixada na spec).
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const [activeSubscriptions, subscriptionsByPlan, payments] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: "active" },
      select: { plan: { select: { priceCents: true } } },
    }),
    prisma.subscription.groupBy({
      by: ["planId", "status"],
      _count: { _all: true },
    }),
    prisma.paymentTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_PAYMENTS_LIMIT,
      select: {
        id: true,
        amountCents: true,
        method: true,
        status: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  const mrrCents = activeSubscriptions.reduce(
    (sum, subscription) => sum + subscription.plan.priceCents,
    0,
  );

  const plans = await prisma.subscriptionPlan.findMany({ select: { id: true, tier: true } });
  const tierByPlanId = new Map(plans.map((plan) => [plan.id, plan.tier]));
  const subscribersByTierAndStatus = subscriptionsByPlan.map((group) => ({
    tier: tierByPlanId.get(group.planId) ?? ("entry" as PlanTier),
    status: group.status,
    count: group._count._all,
  }));

  return {
    mrrCents,
    subscribersByTierAndStatus,
    recentPayments: payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      method: payment.method,
      status: payment.status,
      userEmail: payment.user?.email ?? null,
      createdAt: payment.createdAt,
    })),
  };
}
