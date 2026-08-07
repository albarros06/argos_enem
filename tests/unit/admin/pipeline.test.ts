import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPipelineHealth } from "@/modules/admin/pipeline";
import { createUser, resetDb } from "../../helpers";

// Cada competência só aceita múltiplos de 40 (0-200), somando ao total — distribui
// o totalScore desejado do teste nesse formato válido.
function competencyScores(totalScore: number): [number, number, number, number, number] {
  const scores: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let remaining = totalScore;
  for (let i = 0; i < 5; i++) {
    const take = Math.min(200, remaining);
    scores[i] = take;
    remaining -= take;
  }
  return scores;
}

async function createSubmission(params: {
  userId: string;
  status:
    | "pending"
    | "transcribing"
    | "awaiting_review"
    | "grading"
    | "completed"
    | "failed"
    | "expired";
  failureReason?: "extraction_failed" | "insufficient_text" | "multi_page_pdf" | "grading_failed";
  evaluation?: {
    totalScore: number;
    zeroReason?: "insufficient_text" | "genre_disregard" | "theme_disconnection";
  };
}) {
  const scores = params.evaluation ? competencyScores(params.evaluation.totalScore) : null;
  return prisma.submission.create({
    data: {
      userId: params.userId,
      themeText: "Tema",
      imageSha256: Math.random().toString(16).slice(2).padEnd(64, "0"),
      status: params.status,
      failureReason: params.failureReason,
      evaluation:
        params.evaluation && scores
          ? {
              create: {
                scoreC1: scores[0],
                scoreC2: scores[1],
                scoreC3: scores[2],
                scoreC4: scores[3],
                scoreC5: scores[4],
                totalScore: params.evaluation.totalScore,
                justifications: {},
                generalFeedback: "ok",
                rubricVersion: "test",
                modelId: "test",
                zeroReason: params.evaluation.zeroReason,
              },
            }
          : undefined,
    },
  });
}

describe("admin getPipelineHealth", () => {
  beforeEach(resetDb);

  it("includes all 7 SubmissionStatus values, zero-count ones included", async () => {
    const user = await createUser();
    await createSubmission({
      userId: user.id,
      status: "completed",
      evaluation: { totalScore: 800 },
    });

    const health = await getPipelineHealth();

    const statuses = health.statusCounts.map((s) => s.status).sort();
    expect(statuses).toEqual(
      [
        "pending",
        "transcribing",
        "awaiting_review",
        "grading",
        "completed",
        "failed",
        "expired",
      ].sort(),
    );
    expect(health.statusCounts.find((s) => s.status === "completed")?.count).toBe(1);
    expect(health.statusCounts.find((s) => s.status === "pending")?.count).toBe(0);
  });

  it("breaks down failure and zero reasons correctly", async () => {
    const user = await createUser();
    await createSubmission({
      userId: user.id,
      status: "failed",
      failureReason: "extraction_failed",
    });
    await createSubmission({
      userId: user.id,
      status: "failed",
      failureReason: "extraction_failed",
    });
    await createSubmission({ userId: user.id, status: "failed", failureReason: "grading_failed" });
    await createSubmission({
      userId: user.id,
      status: "completed",
      evaluation: { totalScore: 0, zeroReason: "genre_disregard" },
    });

    const health = await getPipelineHealth();

    expect(health.failureReasonCounts.find((f) => f.reason === "extraction_failed")?.count).toBe(2);
    expect(health.failureReasonCounts.find((f) => f.reason === "grading_failed")?.count).toBe(1);
    expect(health.zeroReasonCounts.find((z) => z.reason === "genre_disregard")?.count).toBe(1);
  });

  it("computes the score distribution only over completed submissions", async () => {
    const user = await createUser();
    await createSubmission({
      userId: user.id,
      status: "completed",
      evaluation: { totalScore: 560 },
    });
    await createSubmission({
      userId: user.id,
      status: "completed",
      evaluation: { totalScore: 600 },
    });
    await createSubmission({ userId: user.id, status: "grading" }); // no evaluation yet

    const health = await getPipelineHealth();

    expect(health.scoreDistribution.find((b) => b.bucketStart === 500)?.count).toBe(1);
    expect(health.scoreDistribution.find((b) => b.bucketStart === 600)?.count).toBe(1);
    const total = health.scoreDistribution.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(2);
  });
});
