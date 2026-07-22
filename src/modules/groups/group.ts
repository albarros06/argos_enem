import crypto from "crypto";
import type { Group } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

const MAX_PARTICIPANTS = 30;
const MAX_GROUPS_AS_MEMBER = 5;

function generateInviteCode(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function createGroup(userId: string, name: string): Promise<Group> {
  return prisma.group.create({
    data: { name, leaderId: userId, inviteCode: generateInviteCode() },
  });
}

// Une caps (30 participantes incluindo o líder; 5 grupos por aluno como
// membro, sem limite como líder — FR-004, FR-005) e reentrada idempotente.
export async function joinGroup(userId: string, inviteCode: string): Promise<Group> {
  const group = await prisma.group.findUnique({ where: { inviteCode } });
  if (!group) {
    throw new ApiError("INVITE_NOT_FOUND", 404, "Convite não encontrado ou inválido.");
  }
  if (group.leaderId === userId) {
    return group;
  }
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (existing) {
    return group;
  }

  const memberCount = await prisma.groupMember.count({ where: { groupId: group.id } });
  if (memberCount + 1 >= MAX_PARTICIPANTS) {
    throw new ApiError("GROUP_FULL", 409, "Este grupo atingiu o limite de 30 participantes.");
  }
  const memberGroupCount = await prisma.groupMember.count({ where: { userId } });
  if (memberGroupCount >= MAX_GROUPS_AS_MEMBER) {
    throw new ApiError(
      "MEMBER_GROUP_LIMIT",
      409,
      "Você já integra o número máximo de grupos (5) como membro.",
    );
  }

  await prisma.groupMember.create({ data: { groupId: group.id, userId } });
  return group;
}

export async function listForUser(userId: string) {
  const include = {
    _count: { select: { members: true } },
    themes: { where: { status: "active" as const }, select: { id: true }, take: 1 },
  };
  const [led, joined] = await Promise.all([
    prisma.group.findMany({ where: { leaderId: userId }, include }),
    prisma.group.findMany({ where: { members: { some: { userId } } }, include }),
  ]);

  return [
    ...led.map((group) => ({
      id: group.id,
      name: group.name,
      role: "leader" as const,
      memberCount: group._count.members + 1,
      hasActiveTheme: group.themes.length > 0,
    })),
    ...joined.map((group) => ({
      id: group.id,
      name: group.name,
      role: "member" as const,
      memberCount: group._count.members + 1,
      hasActiveTheme: group.themes.length > 0,
    })),
  ];
}

async function isMember(groupId: string, userId: string, group: Group): Promise<boolean> {
  if (group.leaderId === userId) {
    return true;
  }
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return membership !== null;
}

export async function requireGroupMember(groupId: string, userId: string): Promise<Group> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new ApiError("NOT_FOUND", 404, "Grupo não encontrado.");
  }
  if (!(await isMember(groupId, userId, group))) {
    throw new ApiError("NOT_GROUP_MEMBER", 403, "Você não faz parte deste grupo.");
  }
  return group;
}

export async function requireGroupLeader(groupId: string, userId: string): Promise<Group> {
  const group = await requireGroupMember(groupId, userId);
  if (group.leaderId !== userId) {
    throw new ApiError("NOT_GROUP_LEADER", 403, "Apenas o líder do grupo pode fazer isso.");
  }
  return group;
}

// Remove um membro; suas entradas/notas passadas permanecem no histórico do
// grupo (FR-007). O líder não pode se auto-remover por aqui.
export async function removeMember(
  groupId: string,
  leaderId: string,
  userId: string,
): Promise<void> {
  await requireGroupLeader(groupId, leaderId);
  if (userId === leaderId) {
    throw new ApiError("VALIDATION_ERROR", 400, "O líder não pode se remover do grupo.");
  }
  const result = await prisma.groupMember.deleteMany({ where: { groupId, userId } });
  if (result.count === 0) {
    throw new ApiError("NOT_FOUND", 404, "Este aluno não é membro do grupo.");
  }
}

export async function regenerateInvite(groupId: string, leaderId: string): Promise<Group> {
  await requireGroupLeader(groupId, leaderId);
  return prisma.group.update({
    where: { id: groupId },
    data: { inviteCode: generateInviteCode() },
  });
}

export async function deleteGroup(groupId: string, leaderId: string): Promise<void> {
  await requireGroupLeader(groupId, leaderId);
  await prisma.group.delete({ where: { id: groupId } });
}
