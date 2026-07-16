import type { WeeklyTheme } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import { computeAndStoreFinalRanks } from "./ranking";

const DEFAULT_DURATION_DAYS = 7;

export async function getActiveTheme(): Promise<WeeklyTheme | null> {
  return prisma.weeklyTheme.findFirst({ where: { status: "active" } });
}

export async function getThemeById(themeId: string): Promise<WeeklyTheme | null> {
  return prisma.weeklyTheme.findUnique({ where: { id: themeId } });
}

// Lista de temas para o painel admin, com a contagem de participantes.
export async function listThemes(page = 1, pageSize = 20) {
  const [themes, total] = await Promise.all([
    prisma.weeklyTheme.findMany({
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { entries: true } } },
    }),
    prisma.weeklyTheme.count(),
  ]);
  return {
    items: themes.map((theme) => ({
      id: theme.id,
      title: theme.title,
      status: theme.status,
      publishedAt: theme.publishedAt,
      endsAt: theme.endsAt,
      closedAt: theme.closedAt,
      participantCount: theme._count.entries,
    })),
    total,
    page,
    pageSize,
  };
}

// Publica um tema imediatamente com prazo padrão de 7 dias. Apenas um tema
// pode estar ativo por vez (FR-004, FR-005).
export async function publishTheme(
  adminId: string,
  title: string,
  durationDays = DEFAULT_DURATION_DAYS,
): Promise<WeeklyTheme> {
  const active = await getActiveTheme();
  if (active) {
    throw new ApiError(
      "ACTIVE_THEME_EXISTS",
      409,
      "Já existe um tema ativo. Encerre-o antes de publicar outro.",
    );
  }
  const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  return prisma.weeklyTheme.create({
    data: { title, endsAt, publishedById: adminId },
  });
}

// Encerra o tema e congela as colocações finais. Cobre encerramento manual
// (admin) e automático (sweep) com um único ponto de chamada (FR-006, FR-007).
export async function closeTheme(themeId: string): Promise<WeeklyTheme> {
  const theme = await prisma.weeklyTheme.findUnique({ where: { id: themeId } });
  if (!theme) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  if (theme.status === "closed") {
    throw new ApiError("ALREADY_CLOSED", 409, "Este tema já foi encerrado.");
  }
  const closed = await prisma.weeklyTheme.update({
    where: { id: themeId },
    data: { status: "closed", closedAt: new Date() },
  });
  await computeAndStoreFinalRanks(themeId);
  return closed;
}

export async function extendTheme(themeId: string, newEndsAt: Date): Promise<WeeklyTheme> {
  const theme = await prisma.weeklyTheme.findUnique({ where: { id: themeId } });
  if (!theme) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  if (theme.status === "closed") {
    throw new ApiError("ALREADY_CLOSED", 409, "Este tema já foi encerrado.");
  }
  return prisma.weeklyTheme.update({ where: { id: themeId }, data: { endsAt: newEndsAt } });
}

// Encerra automaticamente temas cujo prazo expirou (FR-006). Roda em timer
// iniciado em instrumentation.ts.
export async function closeExpiredThemes(): Promise<number> {
  const expired = await prisma.weeklyTheme.findMany({
    where: { status: "active", endsAt: { lte: new Date() } },
  });
  for (const theme of expired) {
    await closeTheme(theme.id);
  }
  if (expired.length > 0) {
    logger.info("weekly_themes_auto_closed", { count: expired.length });
  }
  return expired.length;
}

const SWEEP_INTERVAL_MS = 60 * 1000;

export function startWeeklyThemeSweep(): NodeJS.Timeout {
  const timer = setInterval(() => {
    closeExpiredThemes().catch((error) => {
      logger.error("weekly_theme_sweep_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
