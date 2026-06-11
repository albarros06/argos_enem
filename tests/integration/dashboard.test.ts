import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { actAs, createUser, jsonRequest, resetDb, routeContext } from "../helpers";

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: { GET: async () => new Response(null), POST: async () => new Response(null) },
    auth: async () => {
      const userId = (globalThis as { __testUserId?: string | null }).__testUserId;
      return userId ? { user: { id: userId } } : null;
    },
    signIn: async () => undefined,
    signOut: async () => undefined,
  }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));

import { GET as dashboardRoute } from "@/app/api/dashboard/route";

async function seedEvaluation(userId: string, scores: [number, number, number, number, number]) {
  const submission = await prisma.submission.create({
    data: {
      userId,
      themeText: "Tema",
      imageSha256: Math.random().toString(16).slice(2).padEnd(64, "0"),
      status: "completed",
    },
  });
  await prisma.evaluation.create({
    data: {
      submissionId: submission.id,
      scoreC1: scores[0],
      scoreC2: scores[1],
      scoreC3: scores[2],
      scoreC4: scores[3],
      scoreC5: scores[4],
      totalScore: scores.reduce((sum, score) => sum + score, 0),
      justifications: { 1: "j1", 2: "j2", 3: "j3", 4: "j4", 5: "j5" },
      generalFeedback: "Comentário.",
      rubricVersion: "test",
      modelId: "fake",
    },
  });
  return submission;
}

async function getDashboardBody() {
  const response = await dashboardRoute(jsonRequest("/api/dashboard", "GET"), routeContext({}));
  expect(response.status).toBe(200);
  return response.json();
}

describe("GET /api/dashboard", () => {
  beforeEach(resetDb);

  it("returns the empty state with zero evaluations", async () => {
    const user = await createUser();
    actAs(user.id);

    const body = await getDashboardBody();
    expect(body.submissionCount).toBe(0);
    expect(body.scoreSeries).toEqual([]);
    expect(body.competencies).toHaveLength(5);
    expect(body.competencies[0]).toMatchObject({ latest: 0, average: 0, trend: "stable" });
  });

  it("returns a baseline with a single evaluation", async () => {
    const user = await createUser();
    actAs(user.id);
    await seedEvaluation(user.id, [120, 160, 120, 160, 80]);

    const body = await getDashboardBody();
    expect(body.submissionCount).toBe(1);
    expect(body.scoreSeries).toHaveLength(1);
    expect(body.scoreSeries[0].totalScore).toBe(640);
    expect(body.competencies.find((c: { competency: number }) => c.competency === 5)).toMatchObject(
      { latest: 80, average: 80, trend: "stable" },
    );
  });

  it("aggregates series, averages, and trends across N evaluations", async () => {
    const user = await createUser();
    actAs(user.id);
    await seedEvaluation(user.id, [80, 80, 80, 80, 80]);
    await seedEvaluation(user.id, [120, 120, 120, 120, 120]);
    await seedEvaluation(user.id, [160, 160, 160, 160, 160]);

    const body = await getDashboardBody();
    expect(body.submissionCount).toBe(3);
    expect(body.scoreSeries.map((p: { totalScore: number }) => p.totalScore)).toEqual([
      400, 600, 800,
    ]);
    const c1 = body.competencies.find((c: { competency: number }) => c.competency === 1);
    expect(c1).toMatchObject({ latest: 160, average: 120, trend: "up" });
    expect(body.scoreSeries[0].submissionId).toBeTruthy(); // link para a avaliação (FR-018)
  });

  it("never mixes data across users (FR-003)", async () => {
    const owner = await createUser();
    await seedEvaluation(owner.id, [200, 200, 200, 200, 200]);

    const other = await createUser();
    actAs(other.id);
    const body = await getDashboardBody();
    expect(body.submissionCount).toBe(0);
  });
});
