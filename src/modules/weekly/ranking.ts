import { prisma } from "@/lib/prisma";

// Ordenação do ranking: maior nota total primeiro; empate desfeito pela
// confirmação mais antiga da submissão (FR-014, FR-020).
type RankedEntry = {
  entryId: string;
  userId: string;
  userName: string;
  displayAs: "real" | "anonymous";
  totalScore: number;
  confirmedAt: Date;
};

function anonymizeName(entry: RankedEntry): string {
  return entry.displayAs === "anonymous" ? "Participante anônimo" : entry.userName;
}

// Entradas com avaliação concluída, já ordenadas pela regra do ranking.
// O conjunto por tema é pequeno (participação premium); ordenar em memória
// mantém a consulta legível sem custo relevante no v1 (Constitution II/IV).
async function rankedEntries(themeId: string): Promise<RankedEntry[]> {
  const entries = await prisma.weeklyThemeEntry.findMany({
    where: { themeId, submission: { status: "completed" } },
    select: {
      id: true,
      userId: true,
      displayAs: true,
      user: { select: { name: true } },
      submission: {
        select: {
          transcription: { select: { confirmedAt: true } },
          evaluation: { select: { totalScore: true } },
        },
      },
    },
  });

  return entries
    .map((entry) => ({
      entryId: entry.id,
      userId: entry.userId,
      userName: entry.user.name,
      displayAs: entry.displayAs,
      totalScore: entry.submission.evaluation?.totalScore ?? 0,
      confirmedAt: entry.submission.transcription?.confirmedAt ?? new Date(0),
    }))
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore || a.confirmedAt.getTime() - b.confirmedAt.getTime(),
    );
}

export interface RankingRow {
  rank: number;
  displayName: string;
  totalScore: number;
  submittedAt: Date;
}

export async function getLiveRanking(themeId: string, limit = 50): Promise<RankingRow[]> {
  const ranked = await rankedEntries(themeId);
  return ranked.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    displayName: anonymizeName(entry),
    totalScore: entry.totalScore,
    submittedAt: entry.confirmedAt,
  }));
}

export async function getParticipantCount(themeId: string): Promise<number> {
  return prisma.weeklyThemeEntry.count({
    where: { themeId, submission: { status: "completed" } },
  });
}

export interface UserRank {
  rank: number;
  totalParticipants: number;
  totalScore: number;
}

// Posição ordinal do usuário entre todos os participantes avaliados — usada
// para mostrar a colocação mesmo fora do top 50 (FR-017). Retorna null se a
// submissão do usuário ainda não foi avaliada.
export async function getUserLiveRank(themeId: string, userId: string): Promise<UserRank | null> {
  const ranked = await rankedEntries(themeId);
  const index = ranked.findIndex((entry) => entry.userId === userId);
  if (index === -1) {
    return null;
  }
  return {
    rank: index + 1,
    totalParticipants: ranked.length,
    totalScore: ranked[index].totalScore,
  };
}

// Congela a colocação final de cada participante no encerramento do tema
// (FR-021). Chamado por closeTheme, cobrindo encerramento manual e automático.
export async function computeAndStoreFinalRanks(themeId: string): Promise<number> {
  const ranked = await rankedEntries(themeId);
  await prisma.$transaction(
    ranked.map((entry, index) =>
      prisma.weeklyThemeEntry.update({
        where: { id: entry.entryId },
        data: { finalRank: index + 1 },
      }),
    ),
  );
  return ranked.length;
}
