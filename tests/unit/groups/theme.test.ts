import { beforeEach, describe, expect, it } from "vitest";
import { closeTheme, createGroup, joinGroup, proposeTheme } from "@/modules/groups";
import { createUser, resetDb } from "../../helpers";

describe("group theme lifecycle", () => {
  beforeEach(resetDb);

  it("proposes a theme, activating it", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const theme = await proposeTheme(group.id, leader.id, "Tema A");
    expect(theme.status).toBe("active");
  });

  it("rejects a second active theme", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    await proposeTheme(group.id, leader.id, "Tema A");
    await expect(proposeTheme(group.id, leader.id, "Tema B")).rejects.toMatchObject({
      code: "ACTIVE_THEME_EXISTS",
    });
  });

  it("allows proposing a new theme after the previous one is closed", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const first = await proposeTheme(group.id, leader.id, "Tema A");
    await closeTheme(group.id, leader.id, first.id);
    const second = await proposeTheme(group.id, leader.id, "Tema B");
    expect(second.status).toBe("active");
  });

  it("rejects a non-leader proposing or closing a theme", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const member = await createUser();
    await joinGroup(member.id, group.inviteCode);

    await expect(proposeTheme(group.id, member.id, "Tema A")).rejects.toMatchObject({
      code: "NOT_GROUP_LEADER",
    });

    const theme = await proposeTheme(group.id, leader.id, "Tema A");
    await expect(closeTheme(group.id, member.id, theme.id)).rejects.toMatchObject({
      code: "NOT_GROUP_LEADER",
    });
  });

  it("rejects closing an already-closed theme", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const theme = await proposeTheme(group.id, leader.id, "Tema A");
    await closeTheme(group.id, leader.id, theme.id);
    await expect(closeTheme(group.id, leader.id, theme.id)).rejects.toMatchObject({
      code: "ALREADY_CLOSED",
    });
  });
});
