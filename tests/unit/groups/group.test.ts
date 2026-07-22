import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createGroup,
  deleteGroup,
  joinGroup,
  regenerateInvite,
  removeMember,
} from "@/modules/groups";
import { createUser, resetDb } from "../../helpers";

describe("group creation and membership", () => {
  beforeEach(resetDb);

  it("creates a group with the caller as leader", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    expect(group.leaderId).toBe(leader.id);
    expect(group.inviteCode).toBeTruthy();
  });

  it("joins a group by invite code", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const member = await createUser();
    await joinGroup(member.id, group.inviteCode);
    const row = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: member.id } },
    });
    expect(row).not.toBeNull();
  });

  it("rejects an invalid invite code", async () => {
    const member = await createUser();
    await expect(joinGroup(member.id, "codigo-invalido")).rejects.toMatchObject({
      code: "INVITE_NOT_FOUND",
    });
  });

  it("is a no-op success if the user already belongs to the group", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const member = await createUser();
    await joinGroup(member.id, group.inviteCode);
    await expect(joinGroup(member.id, group.inviteCode)).resolves.toMatchObject({ id: group.id });
    expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(1);
  });

  it("rejects joining once the group has 30 participants (leader + 29 members)", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    for (let i = 0; i < 29; i++) {
      const member = await createUser();
      await joinGroup(member.id, group.inviteCode);
    }
    const overflow = await createUser();
    await expect(joinGroup(overflow.id, group.inviteCode)).rejects.toMatchObject({
      code: "GROUP_FULL",
    });
  });

  it("rejects a 6th membership for a student already in 5 groups (leading doesn't count)", async () => {
    const member = await createUser();
    // O próprio aluno lidera um grupo — não deve contar para o limite de 5 como membro.
    await createGroup(member.id, "Grupo que eu lidero");

    for (let i = 0; i < 5; i++) {
      const leader = await createUser();
      const group = await createGroup(leader.id, `Grupo ${i}`);
      await joinGroup(member.id, group.inviteCode);
    }

    const leader = await createUser();
    const sixth = await createGroup(leader.id, "Sexto grupo");
    await expect(joinGroup(member.id, sixth.inviteCode)).rejects.toMatchObject({
      code: "MEMBER_GROUP_LIMIT",
    });
  });
});

describe("group leader management", () => {
  beforeEach(resetDb);

  it("frees the removed member's slot but leaves their finalRank untouched", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const member = await createUser();
    await joinGroup(member.id, group.inviteCode);

    const theme = await prisma.groupTheme.create({
      data: { groupId: group.id, title: "Tema", status: "closed" },
    });
    const submission = await prisma.submission.create({
      data: {
        userId: member.id,
        themeText: "Tema",
        imageSha256: "a".repeat(64),
        status: "completed",
      },
    });
    const entry = await prisma.groupThemeEntry.create({
      data: { themeId: theme.id, userId: member.id, submissionId: submission.id, finalRank: 1 },
    });

    await removeMember(group.id, leader.id, member.id);

    expect(
      await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: member.id } },
      }),
    ).toBeNull();
    const persisted = await prisma.groupThemeEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(persisted.finalRank).toBe(1);
  });

  it("rejects the leader removing themself", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    await expect(removeMember(group.id, leader.id, leader.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("regenerating the invite invalidates the previous code", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const oldCode = group.inviteCode;
    const updated = await regenerateInvite(group.id, leader.id);
    expect(updated.inviteCode).not.toBe(oldCode);

    const member = await createUser();
    await expect(joinGroup(member.id, oldCode)).rejects.toMatchObject({
      code: "INVITE_NOT_FOUND",
    });
    await expect(joinGroup(member.id, updated.inviteCode)).resolves.toMatchObject({
      id: group.id,
    });
  });

  it("deleting the group cascades to themes, contents, entries, and members", async () => {
    const leader = await createUser();
    const group = await createGroup(leader.id, "Turma A");
    const member = await createUser();
    await joinGroup(member.id, group.inviteCode);
    const theme = await prisma.groupTheme.create({ data: { groupId: group.id, title: "Tema" } });
    await prisma.groupThemeContent.create({
      data: { themeId: theme.id, kind: "text", body: "Apoio", displayOrder: 0 },
    });

    await deleteGroup(group.id, leader.id);

    expect(await prisma.group.findUnique({ where: { id: group.id } })).toBeNull();
    expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(0);
    expect(await prisma.groupTheme.count({ where: { groupId: group.id } })).toBe(0);
    expect(await prisma.groupThemeContent.count({ where: { themeId: theme.id } })).toBe(0);
  });
});
