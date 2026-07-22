import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { FAKE_ESSAY_TEXT } from "@/modules/transcription";
import { runAccountDeletion } from "@/modules/auth/deletion";
import { proposeTheme } from "@/modules/groups";
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

import { GET as listGroupsRoute, POST as createGroupRoute } from "@/app/api/groups/route";
import { POST as joinGroupRoute } from "@/app/api/groups/join/route";
import { GET as getGroupRoute, DELETE as deleteGroupRoute } from "@/app/api/groups/[id]/route";
import { POST as regenerateInviteRoute } from "@/app/api/groups/[id]/invite/route";
import { DELETE as removeMemberRoute } from "@/app/api/groups/[id]/members/[userId]/route";
import { POST as proposeThemeRoute } from "@/app/api/groups/[id]/themes/route";
import { PATCH as closeThemeRoute } from "@/app/api/groups/[id]/themes/[themeId]/route";
import { POST as presignContentRoute } from "@/app/api/groups/[id]/themes/[themeId]/content-upload-url/route";
import { POST as addContentRoute } from "@/app/api/groups/[id]/themes/[themeId]/contents/route";

import { POST as createSubmissionRoute } from "@/app/api/submissions/route";
import { GET as getSubmissionRoute } from "@/app/api/submissions/[id]/route";
import { POST as uploadedRoute } from "@/app/api/submissions/[id]/uploaded/route";
import { POST as confirmRoute } from "@/app/api/submissions/[id]/confirm/route";

async function waitForSubmissionStatus(submissionId: string, expected: string) {
  await vi.waitFor(
    async () => {
      const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
      expect(submission.status).toBe(expected);
    },
    { timeout: 10_000, interval: 100 },
  );
}

describe("groups API — creation, invite, join", () => {
  beforeEach(resetDb);

  it("POST /api/groups returns the group with the caller as leader and an inviteCode", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const response = await createGroupRoute(
      jsonRequest("/api/groups", "POST", { name: "Turma A" }),
      routeContext({}),
    );
    expect(response.status).toBe(201);
    const group = await response.json();
    expect(group.leaderId).toBe(leader.id);
    expect(group.inviteCode).toBeTruthy();

    const list = await (
      await listGroupsRoute(jsonRequest("/api/groups", "GET"), routeContext({}))
    ).json();
    expect(list.groups).toEqual([
      expect.objectContaining({ id: group.id, role: "leader", hasActiveTheme: false }),
    ]);
  });

  it("POST /api/groups/join adds a GroupMember row", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();

    const member = await createUser();
    actAs(member.id);
    const join = await joinGroupRoute(
      jsonRequest("/api/groups/join", "POST", { inviteCode: group.inviteCode }),
      routeContext({}),
    );
    expect(join.status).toBe(200);

    const detail = await (
      await getGroupRoute(
        jsonRequest(`/api/groups/${group.id}`, "GET"),
        routeContext({ id: group.id }),
      )
    ).json();
    expect(detail.members.map((m: { userId: string }) => m.userId)).toContain(member.id);
  });

  it("an invalid invite code returns INVITE_NOT_FOUND", async () => {
    const user = await createUser();
    actAs(user.id);
    const response = await joinGroupRoute(
      jsonRequest("/api/groups/join", "POST", { inviteCode: "codigo-invalido" }),
      routeContext({}),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("INVITE_NOT_FOUND");
  });

  it("only the leader sees the invite code in the group detail view", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();

    const member = await createUser();
    actAs(member.id);
    await joinGroupRoute(
      jsonRequest("/api/groups/join", "POST", { inviteCode: group.inviteCode }),
      routeContext({}),
    );
    const asMember = await (
      await getGroupRoute(
        jsonRequest(`/api/groups/${group.id}`, "GET"),
        routeContext({ id: group.id }),
      )
    ).json();
    expect(asMember.group.inviteCode).toBeNull();

    actAs(leader.id);
    const asLeader = await (
      await getGroupRoute(
        jsonRequest(`/api/groups/${group.id}`, "GET"),
        routeContext({ id: group.id }),
      )
    ).json();
    expect(asLeader.group.inviteCode).toBe(group.inviteCode);
  });
});

describe("groups API — theme proposal and support content", () => {
  beforeEach(resetDb);

  it("leader proposes a theme with text and file content; leader closes it", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();

    const proposed = await proposeThemeRoute(
      jsonRequest(`/api/groups/${group.id}/themes`, "POST", { title: "Tema do grupo" }),
      routeContext({ id: group.id }),
    );
    expect(proposed.status).toBe(201);
    const theme = await proposed.json();
    expect(theme.status).toBe("active");

    const addText = await addContentRoute(
      jsonRequest(`/api/groups/${group.id}/themes/${theme.id}/contents`, "POST", {
        kind: "text",
        body: "Texto de apoio",
        displayOrder: 0,
      }),
      routeContext({ id: group.id, themeId: theme.id }),
    );
    expect(addText.status).toBe(201);

    const presign = await presignContentRoute(
      jsonRequest(`/api/groups/${group.id}/themes/${theme.id}/content-upload-url`, "POST", {
        fileType: "pdf",
        contentType: "application/pdf",
        sizeBytes: 1000,
      }),
      routeContext({ id: group.id, themeId: theme.id }),
    );
    expect(presign.status).toBe(200);
    const { contentId, uploadUrl } = await presign.json();
    const fileKey = decodeURIComponent(
      new URL(uploadUrl).pathname.replace("/api/fake-upload/", ""),
    );
    await storage().putObject(fileKey, Buffer.from("pdf-fake"), "application/pdf");

    const addFile = await addContentRoute(
      jsonRequest(`/api/groups/${group.id}/themes/${theme.id}/contents`, "POST", {
        kind: "file",
        contentId,
        fileType: "pdf",
        displayOrder: 1,
      }),
      routeContext({ id: group.id, themeId: theme.id }),
    );
    expect(addFile.status).toBe(201);

    const detail = await (
      await getGroupRoute(
        jsonRequest(`/api/groups/${group.id}`, "GET"),
        routeContext({ id: group.id }),
      )
    ).json();
    expect(detail.activeTheme.contents).toHaveLength(2);
    const fileContent = detail.activeTheme.contents.find(
      (c: { kind: string }) => c.kind === "file",
    );
    expect(fileContent.fileUrl).toBeTruthy();

    const closed = await closeThemeRoute(
      jsonRequest(`/api/groups/${group.id}/themes/${theme.id}`, "PATCH", { action: "close" }),
      routeContext({ id: group.id, themeId: theme.id }),
    );
    expect(closed.status).toBe(200);
    const closedTheme = await closed.json();
    expect(closedTheme.status).toBe("closed");
    expect(closedTheme.closedAt).toBeTruthy();
  });
});

describe("groups API — member submission and ranking", () => {
  beforeEach(resetDb);

  it("full submit → confirm → evaluate → ranking, with anonymous display masked", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();
    const theme = await proposeTheme(group.id, leader.id, "Tema do grupo");

    const member = await createUser();
    actAs(member.id);
    await joinGroupRoute(
      jsonRequest("/api/groups/join", "POST", { inviteCode: group.inviteCode }),
      routeContext({}),
    );

    const created = await createSubmissionRoute(
      jsonRequest("/api/submissions", "POST", {
        themeText: "Tema do grupo",
        imageSha256: "a".repeat(64),
        contentType: "image/jpeg",
        sizeBytes: 500_000,
        groupThemeId: theme.id,
      }),
      routeContext({}),
    );
    expect(created.status).toBe(201);
    const { submissionId, uploadUrl } = await created.json();
    const imageKey = decodeURIComponent(
      new URL(uploadUrl).pathname.replace("/api/fake-upload/", ""),
    );
    await storage().putObject(imageKey, Buffer.from("foto-fake"), "image/jpeg");

    await uploadedRoute(
      jsonRequest(`/api/submissions/${submissionId}/uploaded`, "POST"),
      routeContext({ id: submissionId }),
    );
    await vi.waitFor(
      async () => {
        const view = await (
          await getSubmissionRoute(
            jsonRequest(`/api/submissions/${submissionId}`, "GET"),
            routeContext({ id: submissionId }),
          )
        ).json();
        expect(view.status).toBe("awaiting_review");
      },
      { timeout: 5000, interval: 50 },
    );

    const confirm = await confirmRoute(
      jsonRequest(`/api/submissions/${submissionId}/confirm`, "POST", {
        confirmedText: FAKE_ESSAY_TEXT,
        groupDisplayAs: "anonymous",
      }),
      routeContext({ id: submissionId }),
    );
    expect(confirm.status).toBe(200);

    await waitForSubmissionStatus(submissionId, "completed");

    const detail = await (
      await getGroupRoute(
        jsonRequest(`/api/groups/${group.id}`, "GET"),
        routeContext({ id: group.id }),
      )
    ).json();
    expect(detail.ranking).toHaveLength(1);
    expect(detail.ranking[0].displayName).toBe("Participante anônimo");
  });

  it("rejects a second submission to the same theme", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();
    const theme = await proposeTheme(group.id, leader.id, "Tema do grupo");

    const first = await createSubmissionRoute(
      jsonRequest("/api/submissions", "POST", {
        themeText: "Tema do grupo",
        imageSha256: "b".repeat(64),
        contentType: "image/jpeg",
        sizeBytes: 500_000,
        groupThemeId: theme.id,
      }),
      routeContext({}),
    );
    expect(first.status).toBe(201);

    const second = await createSubmissionRoute(
      jsonRequest("/api/submissions", "POST", {
        themeText: "Tema do grupo",
        imageSha256: "c".repeat(64),
        contentType: "image/jpeg",
        sizeBytes: 500_000,
        groupThemeId: theme.id,
      }),
      routeContext({}),
    );
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("ALREADY_ENTERED");
  });
});

describe("groups API — leader management", () => {
  beforeEach(resetDb);

  it("removing a member revokes their access but keeps their ranking row", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();

    const member = await createUser();
    actAs(member.id);
    await joinGroupRoute(
      jsonRequest("/api/groups/join", "POST", { inviteCode: group.inviteCode }),
      routeContext({}),
    );

    actAs(leader.id);
    const remove = await removeMemberRoute(
      jsonRequest(`/api/groups/${group.id}/members/${member.id}`, "DELETE"),
      routeContext({ id: group.id, userId: member.id }),
    );
    expect(remove.status).toBe(200);

    actAs(member.id);
    const forbidden = await getGroupRoute(
      jsonRequest(`/api/groups/${group.id}`, "GET"),
      routeContext({ id: group.id }),
    );
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe("NOT_GROUP_MEMBER");
  });

  it("regenerating the invite invalidates the old code", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();
    const oldCode = group.inviteCode;

    const regenerate = await regenerateInviteRoute(
      jsonRequest(`/api/groups/${group.id}/invite`, "POST"),
      routeContext({ id: group.id }),
    );
    expect(regenerate.status).toBe(200);

    const other = await createUser();
    actAs(other.id);
    const rejoin = await joinGroupRoute(
      jsonRequest("/api/groups/join", "POST", { inviteCode: oldCode }),
      routeContext({}),
    );
    expect(rejoin.status).toBe(404);
    expect((await rejoin.json()).error.code).toBe("INVITE_NOT_FOUND");
  });

  it("deleting the group returns 404 for all former members", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();

    const member = await createUser();
    actAs(member.id);
    await joinGroupRoute(
      jsonRequest("/api/groups/join", "POST", { inviteCode: group.inviteCode }),
      routeContext({}),
    );

    actAs(leader.id);
    const del = await deleteGroupRoute(
      jsonRequest(`/api/groups/${group.id}`, "DELETE"),
      routeContext({ id: group.id }),
    );
    expect(del.status).toBe(200);

    actAs(member.id);
    const afterDelete = await getGroupRoute(
      jsonRequest(`/api/groups/${group.id}`, "GET"),
      routeContext({ id: group.id }),
    );
    expect(afterDelete.status).toBe(404);
  });
});

describe("groups + LGPD account deletion", () => {
  beforeEach(resetDb);

  it("deleting a leader's account leaves the group intact with leaderId null", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();

    await runAccountDeletion(leader.id);

    const persisted = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(persisted.leaderId).toBeNull();

    await expect(proposeTheme(group.id, leader.id, "Tema")).rejects.toThrow();
  });

  it("deleting a member's account cascades their entries without renumbering other ranks", async () => {
    const leader = await createUser();
    actAs(leader.id);
    const group = await (
      await createGroupRoute(
        jsonRequest("/api/groups", "POST", { name: "Turma A" }),
        routeContext({}),
      )
    ).json();
    const theme = await proposeTheme(group.id, leader.id, "Tema do grupo");

    const memberA = await createUser();
    const memberB = await createUser();
    for (const member of [memberA, memberB]) {
      actAs(member.id);
      await joinGroupRoute(
        jsonRequest("/api/groups/join", "POST", { inviteCode: group.inviteCode }),
        routeContext({}),
      );
    }

    const submissionA = await prisma.submission.create({
      data: {
        userId: memberA.id,
        themeText: "t",
        imageSha256: "d".repeat(64),
        status: "completed",
      },
    });
    await prisma.groupThemeEntry.create({
      data: { themeId: theme.id, userId: memberA.id, submissionId: submissionA.id, finalRank: 1 },
    });
    const submissionB = await prisma.submission.create({
      data: {
        userId: memberB.id,
        themeText: "t",
        imageSha256: "e".repeat(64),
        status: "completed",
      },
    });
    await prisma.groupThemeEntry.create({
      data: { themeId: theme.id, userId: memberB.id, submissionId: submissionB.id, finalRank: 2 },
    });

    await runAccountDeletion(memberA.id);

    expect(
      await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: memberA.id } },
      }),
    ).toBeNull();
    expect(await prisma.groupThemeEntry.count({ where: { userId: memberA.id } })).toBe(0);

    const remaining = await prisma.groupThemeEntry.findUniqueOrThrow({
      where: { themeId_userId: { themeId: theme.id, userId: memberB.id } },
    });
    expect(remaining.finalRank).toBe(2);
  });
});
