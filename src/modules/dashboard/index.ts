import { prisma } from "@/lib/prisma";

export interface CompetencySummary {
  competency: number;
  latest: number;
  average: number;
  trend: "up" | "down" | "stable";
}

export interface DashboardData {
  scoreSeries: { date: Date; totalScore: number; submissionId: string }[];
  competencies: CompetencySummary[];
  submissionCount: number;
}

const SCORE_FIELDS = ["scoreC1", "scoreC2", "scoreC3", "scoreC4", "scoreC5"] as const;

// Agregações simples sobre Evaluation⋈Submission, sempre limitadas ao dono
// (FR-003, FR-016..018). Consultas indexadas diretas — sem views materializadas.
export async function getDashboard(userId: string): Promise<DashboardData> {
  const evaluations = await prisma.evaluation.findMany({
    where: { submission: { userId } },
    orderBy: { createdAt: "asc" },
    select: {
      submissionId: true,
      createdAt: true,
      totalScore: true,
      scoreC1: true,
      scoreC2: true,
      scoreC3: true,
      scoreC4: true,
      scoreC5: true,
    },
  });

  const scoreSeries = evaluations.map((evaluation) => ({
    date: evaluation.createdAt,
    totalScore: evaluation.totalScore,
    submissionId: evaluation.submissionId,
  }));

  const competencies = SCORE_FIELDS.map((field, index) => {
    const scores = evaluations.map((evaluation) => evaluation[field]);
    return {
      competency: index + 1,
      latest: scores.at(-1) ?? 0,
      average: scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0,
      trend: computeTrend(scores),
    };
  });

  return { scoreSeries, competencies, submissionCount: evaluations.length };
}

// Tendência: compara a média da metade recente com a da metade anterior.
export function computeTrend(scores: number[]): "up" | "down" | "stable" {
  if (scores.length < 2) {
    return "stable";
  }
  const half = Math.floor(scores.length / 2);
  const older = scores.slice(0, half);
  const recent = scores.slice(half);
  const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
  const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
  if (recentAvg - olderAvg > 10) {
    return "up";
  }
  if (olderAvg - recentAvg > 10) {
    return "down";
  }
  return "stable";
}
