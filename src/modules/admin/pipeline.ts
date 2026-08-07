import { prisma } from "@/lib/prisma";
import type { FailureReason, SubmissionStatus, ZeroReason } from "@prisma/client";

const ALL_STATUSES: SubmissionStatus[] = [
  "pending",
  "transcribing",
  "awaiting_review",
  "grading",
  "completed",
  "failed",
  "expired",
];

const SCORE_BUCKET_WIDTH = 100;
const SCORE_BUCKET_COUNT = 10; // 0-99 ... 900-999 (ENEM total score ranges 0-1000)

export interface PipelineHealth {
  statusCounts: { status: SubmissionStatus; count: number }[];
  failureReasonCounts: { reason: FailureReason; count: number }[];
  zeroReasonCounts: { reason: ZeroReason; count: number }[];
  scoreDistribution: { bucketStart: number; count: number }[];
}

export async function getPipelineHealth(): Promise<PipelineHealth> {
  const [statusGroups, failureGroups, zeroReasonGroups, completedScores] = await Promise.all([
    prisma.submission.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.submission.groupBy({
      by: ["failureReason"],
      where: { failureReason: { not: null } },
      _count: { _all: true },
    }),
    prisma.evaluation.groupBy({
      by: ["zeroReason"],
      where: { zeroReason: { not: null } },
      _count: { _all: true },
    }),
    prisma.evaluation.findMany({
      where: { submission: { status: "completed" } },
      select: { totalScore: true },
    }),
  ]);

  const countByStatus = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const statusCounts = ALL_STATUSES.map((status) => ({
    status,
    count: countByStatus.get(status) ?? 0,
  }));

  const failureReasonCounts = failureGroups.map((group) => ({
    reason: group.failureReason as FailureReason,
    count: group._count._all,
  }));

  const zeroReasonCounts = zeroReasonGroups.map((group) => ({
    reason: group.zeroReason as ZeroReason,
    count: group._count._all,
  }));

  const bucketCounts = new Array(SCORE_BUCKET_COUNT).fill(0);
  for (const { totalScore } of completedScores) {
    const index = Math.min(Math.floor(totalScore / SCORE_BUCKET_WIDTH), SCORE_BUCKET_COUNT - 1);
    bucketCounts[index] += 1;
  }
  const scoreDistribution = bucketCounts.map((count, index) => ({
    bucketStart: index * SCORE_BUCKET_WIDTH,
    count,
  }));

  return { statusCounts, failureReasonCounts, zeroReasonCounts, scoreDistribution };
}
