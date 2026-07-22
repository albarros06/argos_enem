import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getActiveTheme, getLatestClosedTheme } from "./theme";
import { getThemeContents, type ContentView } from "./content";
import { getLiveRanking, type RankingRow } from "./ranking";

export interface GroupDetailView {
  group: {
    id: string;
    name: string;
    leaderId: string | null;
    leaderName: string | null;
    inviteCode: string | null;
    memberCount: number;
  };
  members: { userId: string; name: string; role: "leader" | "member"; joinedAt: Date | null }[];
  activeTheme: { id: string; title: string; publishedAt: Date; contents: ContentView[] } | null;
  ranking: RankingRow[];
}

// Visão composta da página de grupo: dados do grupo, membros, tema ativo (ou
// ranking congelado do último tema encerrado) — reúne group/theme/content/
// ranking num único payload para a API e a página do App Router. O código de
// convite só é exposto ao líder — membros não podem convidar outros alunos.
export async function getGroupDetailView(
  groupId: string,
  callerId: string,
): Promise<GroupDetailView> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      leader: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!group) {
    throw new ApiError("NOT_FOUND", 404, "Grupo não encontrado.");
  }

  const members: GroupDetailView["members"] = [];
  if (group.leader) {
    members.push({
      userId: group.leader.id,
      name: group.leader.name,
      role: "leader",
      joinedAt: null,
    });
  }
  for (const member of group.members) {
    members.push({
      userId: member.user.id,
      name: member.user.name,
      role: "member",
      joinedAt: member.joinedAt,
    });
  }

  const activeTheme = await getActiveTheme(groupId);
  const rankingTheme = activeTheme ?? (await getLatestClosedTheme(groupId));

  return {
    group: {
      id: group.id,
      name: group.name,
      leaderId: group.leaderId,
      leaderName: group.leader?.name ?? null,
      inviteCode: group.leaderId === callerId ? group.inviteCode : null,
      memberCount: members.length,
    },
    members,
    activeTheme: activeTheme
      ? {
          id: activeTheme.id,
          title: activeTheme.title,
          publishedAt: activeTheme.publishedAt,
          contents: await getThemeContents(activeTheme.id),
        }
      : null,
    ranking: rankingTheme ? await getLiveRanking(rankingTheme.id) : [],
  };
}
