import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { grantManualCredits } from "@/modules/credits";
import { recordAdminAction } from "@/modules/admin/auditLog";
import { getUserDetail } from "@/modules/admin/userDetail";
import { createAdmin, createUser, makeEntry, resetDb } from "../../helpers";

describe("admin getUserDetail", () => {
  beforeEach(resetDb);

  it("returns the full shape for a user with submissions, credits, and a subscription", async () => {
    const user = await createUser();
    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        themeText: "Tema de teste",
        imageSha256: "a".repeat(64),
        status: "completed",
        evaluation: {
          create: {
            scoreC1: 160,
            scoreC2: 160,
            scoreC3: 160,
            scoreC4: 160,
            scoreC5: 160,
            totalScore: 800,
            justifications: {},
            generalFeedback: "ok",
            rubricVersion: "test",
            modelId: "test",
          },
        },
      },
    });
    await grantManualCredits(user.id, 5);
    const subscription = await makeEntry(user.id);
    const admin = await createAdmin();
    await recordAdminAction(admin.id, "credit_grant", user.id, 5, "bônus");

    const detail = await getUserDetail(user.id);

    expect(detail).not.toBeNull();
    expect(detail!.user.id).toBe(user.id);
    expect(detail!.submissions).toHaveLength(1);
    expect(detail!.submissions[0]).toMatchObject({
      id: submission.id,
      totalScore: 800,
      status: "completed",
    });
    expect(detail!.creditBalance.freeRemaining).toBeGreaterThanOrEqual(5);
    expect(detail!.creditTransactions.length).toBeGreaterThan(0);
    expect(detail!.subscription).toMatchObject({ tier: "entry", status: subscription.status });
    expect(detail!.auditHistory).toHaveLength(1);
    expect(detail!.auditHistory[0]).toMatchObject({
      amount: 5,
      reason: "bônus",
      adminEmail: admin.email,
    });
  });

  it("returns empty-state shape for a fresh user", async () => {
    const user = await createUser();

    const detail = await getUserDetail(user.id);

    expect(detail!.submissions).toEqual([]);
    expect(detail!.subscription).toBeNull();
    expect(detail!.auditHistory).toEqual([]);
  });

  it("returns null for an unknown id", async () => {
    expect(await getUserDetail("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns null for a soft-deleted user", async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(await getUserDetail(user.id)).toBeNull();
  });
});
