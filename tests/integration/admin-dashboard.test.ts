import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getUserDetail, searchUsers } from "@/modules/admin";
import { actAs, createAdmin, createUser, jsonRequest, resetDb, routeContext } from "../helpers";

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

import { POST as creditsRoute } from "@/app/api/admin/usuarios/[id]/credits/route";

describe("admin dashboard: search -> detail flow", () => {
  beforeEach(resetDb);

  it("finds a seeded user by search and shows the matching detail", async () => {
    const user = await createUser({ email: "fluxo.completo@teste.com" });
    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        themeText: "Tema do fluxo",
        imageSha256: "b".repeat(64),
        status: "completed",
        evaluation: {
          create: {
            scoreC1: 120,
            scoreC2: 120,
            scoreC3: 120,
            scoreC4: 120,
            scoreC5: 120,
            totalScore: 600,
            justifications: {},
            generalFeedback: "ok",
            rubricVersion: "test",
            modelId: "test",
          },
        },
      },
    });
    await prisma.creditTransaction.create({
      data: { userId: user.id, amount: 3, kind: "manual_grant", cycleId: "manual" },
    });

    const results = await searchUsers("fluxo.completo");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(user.id);

    const detail = await getUserDetail(results[0].id);
    expect(detail).not.toBeNull();
    expect(detail!.user.email).toBe("fluxo.completo@teste.com");
    expect(detail!.submissions).toHaveLength(1);
    expect(detail!.submissions[0]).toMatchObject({ id: submission.id, totalScore: 600 });
    expect(
      detail!.creditTransactions.some((t) => t.amount === 3 && t.kind === "manual_grant"),
    ).toBe(true);
  });
});

describe("admin dashboard: credit grant route", () => {
  beforeEach(resetDb);

  it("grants credits, returns the updated balance, and creates an AdminActionLog row", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    actAs(admin.id);

    const response = await creditsRoute(
      jsonRequest(`/api/admin/usuarios/${user.id}/credits`, "POST", { amount: 5, reason: "bônus" }),
      routeContext({ id: user.id }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.balance.freeRemaining).toBeGreaterThanOrEqual(5);
    expect(body.auditEntry).toMatchObject({ amount: 5, reason: "bônus", adminEmail: admin.email });

    expect(await prisma.adminActionLog.count({ where: { targetUserId: user.id } })).toBe(1);
  });

  it("rejects amount 0 with 400 VALIDATION_ERROR and writes no new rows", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    actAs(admin.id);

    const response = await creditsRoute(
      jsonRequest(`/api/admin/usuarios/${user.id}/credits`, "POST", {
        amount: 0,
        reason: "motivo",
      }),
      routeContext({ id: user.id }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.adminActionLog.count({ where: { targetUserId: user.id } })).toBe(0);
    expect(
      await prisma.creditTransaction.count({ where: { userId: user.id, kind: "manual_grant" } }),
    ).toBe(0);
  });

  it("forbids a non-admin session", async () => {
    const user = await createUser();
    actAs(user.id);

    const response = await creditsRoute(
      jsonRequest(`/api/admin/usuarios/${user.id}/credits`, "POST", { amount: 5, reason: "bônus" }),
      routeContext({ id: user.id }),
    );

    expect(response.status).toBe(403);
  });
});
