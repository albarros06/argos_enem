import { Prisma, type PrismaClient, type WeeklyDisplayAs } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

type Db = Prisma.TransactionClient | PrismaClient;

export async function getEntryByUserAndTheme(themeId: string, userId: string) {
  return prisma.weeklyThemeEntry.findUnique({
    where: { themeId_userId: { themeId, userId } },
  });
}

export async function getEntryBySubmission(submissionId: string) {
  return prisma.weeklyThemeEntry.findUnique({ where: { submissionId } });
}

// Vincula a submissão ao tema. A constraint única (themeId, userId) garante
// uma única participação por tema, mesmo sob concorrência (FR-012).
export async function createEntry(
  themeId: string,
  userId: string,
  submissionId: string,
  db: Db = prisma,
) {
  try {
    return await db.weeklyThemeEntry.create({ data: { themeId, userId, submissionId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(
        "ALREADY_ENTERED",
        409,
        "Você já enviou uma redação para o tema desta semana.",
      );
    }
    throw error;
  }
}

// Remove a participação quando a submissão é abandonada ou falha, liberando a
// vaga do aluno no tema (caso ainda ativo).
export async function deleteEntry(submissionId: string): Promise<void> {
  await prisma.weeklyThemeEntry.deleteMany({ where: { submissionId } });
}

export async function setDisplayAs(submissionId: string, displayAs: WeeklyDisplayAs) {
  return prisma.weeklyThemeEntry.update({ where: { submissionId }, data: { displayAs } });
}
