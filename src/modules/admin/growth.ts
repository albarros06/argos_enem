import { prisma } from "@/lib/prisma";

export interface WindowedCounts {
  last24h: number;
  last7d: number;
  last30d: number;
  allTime: number;
}

export interface GrowthSnapshot {
  signups: WindowedCounts;
  submissions: WindowedCounts;
  verifications: WindowedCounts;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function windowedCount(
  countSince: (since?: Date) => Promise<number>,
): Promise<WindowedCounts> {
  const now = Date.now();
  const [last24h, last7d, last30d, allTime] = await Promise.all([
    countSince(new Date(now - DAY_MS)),
    countSince(new Date(now - 7 * DAY_MS)),
    countSince(new Date(now - 30 * DAY_MS)),
    countSince(undefined),
  ]);
  return { last24h, last7d, last30d, allTime };
}

// Supersede weekly.getAppMetrics: mesmos filtros de base (usuários não
// apagados, submissões não expiradas) para que os totais "allTime" batam com
// os números que o painel antigo exibia, agora quebrados por janela.
export async function getGrowthSnapshot(): Promise<GrowthSnapshot> {
  const [signups, submissions, verifications] = await Promise.all([
    windowedCount((since) =>
      prisma.user.count({
        where: { deletedAt: null, ...(since ? { createdAt: { gte: since } } : {}) },
      }),
    ),
    windowedCount((since) =>
      prisma.submission.count({
        where: { status: { not: "expired" }, ...(since ? { createdAt: { gte: since } } : {}) },
      }),
    ),
    windowedCount((since) =>
      prisma.user.count({
        where: {
          deletedAt: null,
          emailVerifiedAt: since ? { gte: since } : { not: null },
        },
      }),
    ),
  ]);

  return { signups, submissions, verifications };
}
