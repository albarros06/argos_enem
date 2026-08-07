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
