import { prisma } from "@/lib/prisma";
import { getActiveTheme } from "./theme";
import { getThemeContents, type ContentView } from "./content";
import { getLiveRanking, getUserLiveRank, getParticipantCount, type RankingRow } from "./ranking";
import { getEntryByUserAndTheme } from "./entry";

export interface ActiveThemeView {
  theme: { id: string; title: string; endsAt: Date; contents: ContentView[] };
  ranking: RankingRow[];
  participantCount: number;
}

// Visão pública do tema ativo: enunciado, materiais de apoio, ranking (top 50)
// e total de participantes (FR-014, FR-015, FR-018). Null quando não há tema.
export async function getActiveThemeView(): Promise<ActiveThemeView | null> {
  const theme = await getActiveTheme();
  if (!theme) {
    return null;
  }
  const [contents, ranking, participantCount] = await Promise.all([
    getThemeContents(theme.id),
    getLiveRanking(theme.id, 50),
    getParticipantCount(theme.id),
  ]);
  return {
    theme: { id: theme.id, title: theme.title, endsAt: theme.endsAt, contents },
    ranking,
    participantCount,
  };
}

export type MyEntryResult =
  | { status: "no_theme" }
  | { status: "no_entry" }
  | {
      status: "ok";
      submissionId: string;
      submissionStatus: string;
      totalScore: number | null;
      rank: number | null;
      totalParticipants: number;
      displayAs: "real" | "anonymous";
    };

// Colocação do próprio aluno no tema ativo, válida mesmo fora do top 50
// (FR-017). A nota e a posição só existem após a avaliação concluída.
export async function getMyActiveEntryView(userId: string): Promise<MyEntryResult> {
  const theme = await getActiveTheme();
  if (!theme) {
    return { status: "no_theme" };
  }
  const entry = await getEntryByUserAndTheme(theme.id, userId);
  if (!entry) {
    return { status: "no_entry" };
  }
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: entry.submissionId },
    select: { status: true },
  });
  const rankInfo = await getUserLiveRank(theme.id, userId);
  return {
    status: "ok",
    submissionId: entry.submissionId,
    submissionStatus: submission.status,
    totalScore: rankInfo?.totalScore ?? null,
    rank: rankInfo?.rank ?? null,
    totalParticipants: rankInfo?.totalParticipants ?? (await getParticipantCount(theme.id)),
    displayAs: entry.displayAs,
  };
}

export interface HistoryEntry {
  themeId: string;
  themeTitle: string;
  closedAt: Date | null;
  totalScore: number | null;
  finalRank: number;
  totalParticipants: number;
}

// Histórico de participação do aluno: posição final por tema encerrado
// (FR-021, histórico por tema, não cumulativo).
export async function getParticipationHistory(userId: string, page = 1, pageSize = 20) {
  const where = { userId, finalRank: { not: null } };
  const [rows, total] = await Promise.all([
    prisma.weeklyThemeEntry.findMany({
      where,
      orderBy: { theme: { closedAt: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        themeId: true,
        finalRank: true,
        theme: { select: { title: true, closedAt: true } },
        submission: { select: { evaluation: { select: { totalScore: true } } } },
      },
    }),
    prisma.weeklyThemeEntry.count({ where }),
  ]);

  const themeIds = rows.map((row) => row.themeId);
  const counts = await prisma.weeklyThemeEntry.groupBy({
    by: ["themeId"],
    where: { themeId: { in: themeIds }, finalRank: { not: null } },
    _count: { _all: true },
  });
  const countByTheme = new Map(counts.map((count) => [count.themeId, count._count._all]));

  const entries: HistoryEntry[] = rows.map((row) => ({
    themeId: row.themeId,
    themeTitle: row.theme.title,
    closedAt: row.theme.closedAt,
    totalScore: row.submission.evaluation?.totalScore ?? null,
    finalRank: row.finalRank!,
    totalParticipants: countByTheme.get(row.themeId) ?? 0,
  }));

  return {
    entries,
    pagination: { page, totalPages: Math.max(Math.ceil(total / pageSize), 1) },
  };
}
