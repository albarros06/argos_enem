import type { GroupTheme } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { requireGroupLeader } from "./group";
import { computeAndStoreFinalRanks } from "./ranking";

export async function getActiveTheme(groupId: string): Promise<GroupTheme | null> {
  return prisma.groupTheme.findFirst({ where: { groupId, status: "active" } });
}

export async function getLatestClosedTheme(groupId: string): Promise<GroupTheme | null> {
  return prisma.groupTheme.findFirst({
    where: { groupId, status: "closed" },
    orderBy: { closedAt: "desc" },
  });
}

export async function getThemeById(themeId: string): Promise<GroupTheme | null> {
  return prisma.groupTheme.findUnique({ where: { id: themeId } });
}

// Sem prazo automático: o líder encerra manualmente quando quiser (FR-014,
// diferente do tema semanal global — ver research.md).
export async function proposeTheme(
  groupId: string,
  leaderId: string,
  title: string,
): Promise<GroupTheme> {
  await requireGroupLeader(groupId, leaderId);
  const active = await getActiveTheme(groupId);
  if (active) {
    throw new ApiError(
      "ACTIVE_THEME_EXISTS",
      409,
      "Este grupo já tem um tema ativo. Encerre-o antes de propor outro.",
    );
  }
  return prisma.groupTheme.create({ data: { groupId, title } });
}

export async function closeTheme(
  groupId: string,
  leaderId: string,
  themeId: string,
): Promise<GroupTheme> {
  await requireGroupLeader(groupId, leaderId);
  const theme = await prisma.groupTheme.findUnique({ where: { id: themeId } });
  if (!theme || theme.groupId !== groupId) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  if (theme.status === "closed") {
    throw new ApiError("ALREADY_CLOSED", 409, "Este tema já foi encerrado.");
  }
  const closed = await prisma.groupTheme.update({
    where: { id: themeId },
    data: { status: "closed", closedAt: new Date() },
  });
  await computeAndStoreFinalRanks(themeId);
  return closed;
}
