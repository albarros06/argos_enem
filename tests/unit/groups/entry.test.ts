import { beforeEach, describe, expect, it } from "vitest";
import { createGroup, joinGroup, proposeTheme } from "@/modules/groups";
import { createSubmission } from "@/modules/submissions";
import { getBalance } from "@/modules/credits";
import { createUser, makeEntry, resetDb } from "../../helpers";

function submissionBody(overrides?: Record<string, unknown>) {
  return {
    themeText: "Tema qualquer",
    imageSha256: "a".repeat(64),
    contentType: "image/jpeg",
    sizeBytes: 500_000,
    ...overrides,
  };
}

async function setupActiveTheme() {
  const leader = await createUser();
  const group = await createGroup(leader.id, "Turma A");
  const member = await createUser();
  // Participar de temas de grupo exige assinatura (entry ou premium) — a
  // essencial já basta, sem exigir premium (ver createSubmission).
  await makeEntry(member.id);
  await joinGroup(member.id, group.inviteCode);
  const theme = await proposeTheme(group.id, leader.id, "Tema do grupo");
  return { leader, group, member, theme };
}

describe("group theme submission", () => {
  beforeEach(resetDb);

  it("rejects a non-member submitting against a group theme", async () => {
    const { theme } = await setupActiveTheme();
    const outsider = await createUser();
    await makeEntry(outsider.id);
    await expect(
      createSubmission(outsider.id, submissionBody({ groupThemeId: theme.id })),
    ).rejects.toMatchObject({ code: "NOT_GROUP_MEMBER" });
  });

  it("rejects a nonexistent or inactive theme", async () => {
    const { group, leader, member, theme } = await setupActiveTheme();
    await expect(
      createSubmission(member.id, {
        ...submissionBody(),
        groupThemeId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "THEME_NOT_ACTIVE" });

    const { closeTheme } = await import("@/modules/groups");
    await closeTheme(group.id, leader.id, theme.id);
    await expect(
      createSubmission(member.id, { ...submissionBody(), groupThemeId: theme.id }),
    ).rejects.toMatchObject({ code: "THEME_NOT_ACTIVE" });
  });

  it("rejects a duplicate entry for the same theme", async () => {
    const { theme, member } = await setupActiveTheme();
    await createSubmission(member.id, submissionBody({ groupThemeId: theme.id }));
    await expect(
      createSubmission(
        member.id,
        submissionBody({ imageSha256: "b".repeat(64), groupThemeId: theme.id }),
      ),
    ).rejects.toMatchObject({ code: "ALREADY_ENTERED" });
  });

  it("rejects both weeklyThemeId and groupThemeId present", async () => {
    const { theme, member } = await setupActiveTheme();
    await expect(
      createSubmission(member.id, {
        ...submissionBody(),
        weeklyThemeId: "00000000-0000-0000-0000-000000000000",
        groupThemeId: theme.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("accepts an entry-tier (non-premium) member — groups aren't premium-exclusive", async () => {
    const { theme, member } = await setupActiveTheme();
    // O membro tem plano essencial (entry), não premium — grupos exigem apenas
    // alguma assinatura paga, ao contrário do ranking da redação da semana.
    const before = await getBalance(member.id);
    expect(before.freeRemaining).toBeGreaterThan(0);
    await expect(
      createSubmission(member.id, submissionBody({ groupThemeId: theme.id })),
    ).resolves.toMatchObject({ submissionId: expect.any(String) });
  });
});
