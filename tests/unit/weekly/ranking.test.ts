import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  computeAndStoreFinalRanks,
  getLiveRanking,
  getUserLiveRank,
  publishTheme,
} from "@/modules/weekly";
import { createAdmin, createCompletedWeeklyEntry, createUser, resetDb } from "../../helpers";

async function setupThemeWithEntries() {
  const admin = await createAdmin();
  const theme = await publishTheme(admin.id, "Tema A");
  const high = await createUser();
  const mid = await createUser();
  const lowEarly = await createUser();
  const lowLate = await createUser();

  await createCompletedWeeklyEntry({
    themeId: theme.id,
    userId: high.id,
    totalScore: 800,
    confirmedAt: new Date("2026-06-16T10:00:00Z"),
    displayAs: "real",
  });
  await createCompletedWeeklyEntry({
    themeId: theme.id,
    userId: mid.id,
    totalScore: 600,
    confirmedAt: new Date("2026-06-16T11:00:00Z"),
    displayAs: "anonymous",
  });
  // Empate em 400: quem confirmou primeiro fica à frente.
  await createCompletedWeeklyEntry({
    themeId: theme.id,
    userId: lowEarly.id,
    totalScore: 400,
    confirmedAt: new Date("2026-06-16T09:00:00Z"),
  });
  await createCompletedWeeklyEntry({
    themeId: theme.id,
    userId: lowLate.id,
    totalScore: 400,
    confirmedAt: new Date("2026-06-16T12:00:00Z"),
  });

  return { theme, high, mid, lowEarly, lowLate };
}

describe("weekly ranking", () => {
  beforeEach(resetDb);

  it("orders by score desc, breaking ties by earliest confirmation", async () => {
    const { lowEarly } = await setupThemeWithEntries();
    const theme = await prisma.weeklyTheme.findFirstOrThrow();
    const ranking = await getLiveRanking(theme.id, 50);

    expect(ranking.map((row) => row.totalScore)).toEqual([800, 600, 400, 400]);
    expect(ranking[2].totalScore).toBe(400);
    // O empate em 400 favorece quem confirmou mais cedo.
    const earlyRank = await getUserLiveRank(theme.id, lowEarly.id);
    expect(earlyRank?.rank).toBe(3);
  });

  it("masks the name of anonymous participants", async () => {
    await setupThemeWithEntries();
    const theme = await prisma.weeklyTheme.findFirstOrThrow();
    const ranking = await getLiveRanking(theme.id, 50);
    const anonymous = ranking.find((row) => row.totalScore === 600);
    expect(anonymous?.displayName).toBe("Participante anônimo");
  });

  it("returns the user ordinal position even outside the top results", async () => {
    const { lowLate } = await setupThemeWithEntries();
    const theme = await prisma.weeklyTheme.findFirstOrThrow();
    const rank = await getUserLiveRank(theme.id, lowLate.id);
    expect(rank).toMatchObject({ rank: 4, totalParticipants: 4, totalScore: 400 });
  });

  it("returns null rank for a user without a completed submission", async () => {
    const { theme } = await setupThemeWithEntries();
    const outsider = await createUser();
    expect(await getUserLiveRank(theme.id, outsider.id)).toBeNull();
  });

  it("persists final ranks at closure", async () => {
    const { high, lowLate } = await setupThemeWithEntries();
    const theme = await prisma.weeklyTheme.findFirstOrThrow();
    const count = await computeAndStoreFinalRanks(theme.id);
    expect(count).toBe(4);

    const topEntry = await prisma.weeklyThemeEntry.findUniqueOrThrow({
      where: { themeId_userId: { themeId: theme.id, userId: high.id } },
    });
    const lastEntry = await prisma.weeklyThemeEntry.findUniqueOrThrow({
      where: { themeId_userId: { themeId: theme.id, userId: lowLate.id } },
    });
    expect(topEntry.finalRank).toBe(1);
    expect(lastEntry.finalRank).toBe(4);
  });
});
