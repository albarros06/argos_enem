import { prisma } from "@/lib/prisma";

// Mesma ordenação do ranking global: maior nota primeiro, empate desfeito
// pela confirmação mais antiga (FR-019, FR-022).
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

// Grupo é capado em 30 participantes (Group.ts), então o conjunto por tema é
// pequeno o bastante para ordenar em memória sem custo relevante (Constitution
// II/IV) — sem truncagem de top-N, ao contrário do ranking global de 50.
async function rankedEntries(themeId: string): Promise<RankedEntry[]> {
  const entries = await prisma.groupThemeEntry.findMany({
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
      (a, b) => b.totalScore - a.totalScore || a.confirmedAt.getTime() - b.confirmedAt.getTime(),
    );
}

export interface RankingRow {
  rank: number;
  displayName: string;
  totalScore: number;
  submittedAt: Date;
}

export async function getLiveRanking(themeId: string): Promise<RankingRow[]> {
  const ranked = await rankedEntries(themeId);
  return ranked.map((entry, index) => ({
    rank: index + 1,
    displayName: anonymizeName(entry),
    totalScore: entry.totalScore,
    submittedAt: entry.confirmedAt,
  }));
}

// Congela a colocação final de cada participante ao encerrar o tema —
// chamado por closeTheme (FR-019).
export async function computeAndStoreFinalRanks(themeId: string): Promise<number> {
  const ranked = await rankedEntries(themeId);
  await prisma.$transaction(
    ranked.map((entry, index) =>
      prisma.groupThemeEntry.update({
        where: { id: entry.entryId },
        data: { finalRank: index + 1 },
      }),
    ),
  );
  return ranked.length;
}
