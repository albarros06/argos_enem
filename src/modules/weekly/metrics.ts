import { prisma } from "@/lib/prisma";

const COMPETENCIES = [1, 2, 3, 4, 5] as const;
const SCORE_BUCKETS = [0, 40, 80, 120, 160, 200] as const;

export interface ThemeMetrics {
  participantCount: number;
  avgTotalScore: number;
  scoreDistribution: Record<string, Record<string, number>>;
}

// Métricas de um tema, considerando apenas submissões avaliadas (FR-022).
export async function getThemeMetrics(themeId: string): Promise<ThemeMetrics> {
  const entries = await prisma.weeklyThemeEntry.findMany({
    where: { themeId, submission: { status: "completed" } },
    select: {
      submission: {
        select: {
          evaluation: {
            select: {
              totalScore: true,
              scoreC1: true,
              scoreC2: true,
              scoreC3: true,
              scoreC4: true,
              scoreC5: true,
            },
          },
        },
      },
    },
  });

  const evaluations = entries
    .map((entry) => entry.submission.evaluation)
    .filter((evaluation): evaluation is NonNullable<typeof evaluation> => evaluation !== null);

  const participantCount = evaluations.length;
  const avgTotalScore =
    participantCount === 0
      ? 0
      : Math.round(evaluations.reduce((sum, e) => sum + e.totalScore, 0) / participantCount);

  const scoreDistribution: Record<string, Record<string, number>> = {};
  for (const competency of COMPETENCIES) {
    const buckets: Record<string, number> = {};
    for (const bucket of SCORE_BUCKETS) {
      buckets[String(bucket)] = 0;
    }
    for (const evaluation of evaluations) {
      const score = evaluation[`scoreC${competency}` as keyof typeof evaluation] as number;
      buckets[String(score)] = (buckets[String(score)] ?? 0) + 1;
    }
    scoreDistribution[`c${competency}`] = buckets;
  }

  return { participantCount, avgTotalScore, scoreDistribution };
}

export interface AppMetrics {
  totalUsers: number;
  totalSubmissions: number;
  usersByPlan: { tier: "free" | "entry" | "premium"; count: number }[];
}

// Métricas gerais do app para o painel admin (FR-023).
export async function getAppMetrics(): Promise<AppMetrics> {
  const now = new Date();
  const [totalUsers, totalSubmissions, plans, accessibleSubs] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.submission.count({ where: { status: { not: "expired" } } }),
    prisma.subscriptionPlan.findMany({ select: { id: true, tier: true } }),
    prisma.subscription.groupBy({
      by: ["planId"],
      where: {
        status: { in: ["active", "past_due", "canceled"] },
        currentPeriodEnd: { gt: now },
      },
      _count: { _all: true },
    }),
  ]);

  const tierByPlanId = new Map(plans.map((plan) => [plan.id, plan.tier]));
  let entry = 0;
  let premium = 0;
  for (const group of accessibleSubs) {
    const tier = tierByPlanId.get(group.planId);
    if (tier === "premium") {
      premium += group._count._all;
    } else if (tier === "entry") {
      entry += group._count._all;
    }
  }

  return {
    totalUsers,
    totalSubmissions,
    usersByPlan: [
      { tier: "free", count: Math.max(totalUsers - entry - premium, 0) },
      { tier: "entry", count: entry },
      { tier: "premium", count: premium },
    ],
  };
}
