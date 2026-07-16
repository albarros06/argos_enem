import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createEntry,
  deleteEntry,
  getEntryByUserAndTheme,
  publishTheme,
  setDisplayAs,
} from "@/modules/weekly";
import { createAdmin, createUser, createSubmissionRow, resetDb } from "../../helpers";

async function setup() {
  const admin = await createAdmin();
  const theme = await publishTheme(admin.id, "Tema A");
  const user = await createUser();
  const submission = await createSubmissionRow(user.id);
  return { theme, user, submission };
}

describe("weekly theme entry", () => {
  beforeEach(resetDb);

  it("creates an entry linking a submission to a theme", async () => {
    const { theme, user, submission } = await setup();
    const entry = await createEntry(theme.id, user.id, submission.id);
    expect(entry.themeId).toBe(theme.id);
    expect(entry.displayAs).toBe("anonymous");
  });

  it("rejects a second entry for the same user and theme", async () => {
    const { theme, user, submission } = await setup();
    await createEntry(theme.id, user.id, submission.id);
    const another = await createSubmissionRow(user.id);
    await expect(createEntry(theme.id, user.id, another.id)).rejects.toMatchObject({
      code: "ALREADY_ENTERED",
    });
  });

  it("deletes an entry by submission id", async () => {
    const { theme, user, submission } = await setup();
    await createEntry(theme.id, user.id, submission.id);
    await deleteEntry(submission.id);
    expect(await getEntryByUserAndTheme(theme.id, user.id)).toBeNull();
  });

  it("updates the display preference", async () => {
    const { theme, user, submission } = await setup();
    await createEntry(theme.id, user.id, submission.id);
    await setDisplayAs(submission.id, "real");
    const entry = await prisma.weeklyThemeEntry.findUniqueOrThrow({
      where: { submissionId: submission.id },
    });
    expect(entry.displayAs).toBe("real");
  });
});
