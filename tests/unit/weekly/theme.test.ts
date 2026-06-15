import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import {
  closeExpiredThemes,
  closeTheme,
  extendTheme,
  getActiveTheme,
  publishTheme,
} from "@/modules/weekly";
import { createAdmin, resetDb } from "../../helpers";

describe("weekly theme lifecycle", () => {
  beforeEach(resetDb);

  it("publishes a theme active for 7 days by default", async () => {
    const admin = await createAdmin();
    const theme = await publishTheme(admin.id, "Tema A");
    expect(theme.status).toBe("active");
    const days = (theme.endsAt.getTime() - theme.publishedAt.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(7);
  });

  it("rejects publishing while another theme is active", async () => {
    const admin = await createAdmin();
    await publishTheme(admin.id, "Tema A");
    await expect(publishTheme(admin.id, "Tema B")).rejects.toMatchObject({
      code: "ACTIVE_THEME_EXISTS",
    });
  });

  it("allows publishing a new theme after the previous one is closed", async () => {
    const admin = await createAdmin();
    const first = await publishTheme(admin.id, "Tema A");
    await closeTheme(first.id);
    const second = await publishTheme(admin.id, "Tema B");
    expect(second.status).toBe("active");
  });

  it("rejects closing an already-closed theme", async () => {
    const admin = await createAdmin();
    const theme = await publishTheme(admin.id, "Tema A");
    await closeTheme(theme.id);
    await expect(closeTheme(theme.id)).rejects.toMatchObject({ code: "ALREADY_CLOSED" });
  });

  it("extends the deadline of an active theme", async () => {
    const admin = await createAdmin();
    const theme = await publishTheme(admin.id, "Tema A");
    const newEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const extended = await extendTheme(theme.id, newEndsAt);
    expect(extended.endsAt.getTime()).toBe(newEndsAt.getTime());
  });

  it("auto-closes only themes past their deadline", async () => {
    const admin = await createAdmin();
    const theme = await publishTheme(admin.id, "Tema A");
    await prisma.weeklyTheme.update({
      where: { id: theme.id },
      data: { endsAt: new Date(Date.now() - 60 * 1000) },
    });
    const closed = await closeExpiredThemes();
    expect(closed).toBe(1);
    expect(await getActiveTheme()).toBeNull();
  });

  it("does not close themes still within the deadline", async () => {
    const admin = await createAdmin();
    await publishTheme(admin.id, "Tema A");
    expect(await closeExpiredThemes()).toBe(0);
    expect(await getActiveTheme()).not.toBeNull();
  });

  it("throws ApiError when closing a missing theme", async () => {
    await expect(closeTheme("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
