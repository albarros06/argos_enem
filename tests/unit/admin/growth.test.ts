import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getGrowthSnapshot } from "@/modules/admin/growth";
import { createSubmissionRow, createUser, resetDb } from "../../helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

async function backdateUser(userId: string, createdAt: Date) {
  await prisma.user.update({ where: { id: userId }, data: { createdAt } });
}

async function backdateSubmission(submissionId: string, createdAt: Date) {
  await prisma.submission.update({ where: { id: submissionId }, data: { createdAt } });
}

describe("admin getGrowthSnapshot", () => {
  beforeEach(resetDb);

  it("counts signups, submissions, and verifications correctly per window", async () => {
    const now = Date.now();

    const recentUser = await createUser({ verified: false });
    await backdateUser(recentUser.id, new Date(now - 2 * 60 * 60 * 1000)); // 2h ago

    const weekOldUser = await createUser({ verified: false });
    await backdateUser(weekOldUser.id, new Date(now - 3 * DAY_MS)); // 3d ago

    const monthOldUser = await createUser({ verified: false });
    await backdateUser(monthOldUser.id, new Date(now - 20 * DAY_MS)); // 20d ago

    const ancientUser = await createUser({ verified: false });
    await backdateUser(ancientUser.id, new Date(now - 100 * DAY_MS)); // 100d ago

    await prisma.user.update({
      where: { id: recentUser.id },
      data: { emailVerifiedAt: new Date() },
    });

    const recentSubmission = await createSubmissionRow(recentUser.id);
    await backdateSubmission(recentSubmission.id, new Date(now - 2 * 60 * 60 * 1000));

    const snapshot = await getGrowthSnapshot();

    expect(snapshot.signups.last24h).toBe(1);
    expect(snapshot.signups.last7d).toBe(2);
    expect(snapshot.signups.last30d).toBe(3);
    expect(snapshot.signups.allTime).toBe(4);

    expect(snapshot.submissions.last24h).toBe(1);
    expect(snapshot.submissions.allTime).toBe(1);

    expect(snapshot.verifications.last24h).toBe(1);
    expect(snapshot.verifications.allTime).toBe(1);
  });

  it("matches the totals the retired getAppMetrics used to return", async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    await createSubmissionRow(user1.id);
    await prisma.submission.create({
      data: {
        userId: user2.id,
        themeText: "Tema de teste",
        imageSha256: "c".repeat(64),
        status: "expired",
      },
    });

    const snapshot = await getGrowthSnapshot();
    const totalUsers = await prisma.user.count({ where: { deletedAt: null } });
    const totalSubmissions = await prisma.submission.count({
      where: { status: { not: "expired" } },
    });

    expect(snapshot.signups.allTime).toBe(totalUsers);
    expect(snapshot.submissions.allTime).toBe(totalSubmissions);
  });
});
