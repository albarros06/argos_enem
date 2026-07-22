import { Prisma, type PrismaClient, type GroupDisplayAs } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

type Db = Prisma.TransactionClient | PrismaClient;

export async function getEntryByUserAndTheme(themeId: string, userId: string) {
  return prisma.groupThemeEntry.findUnique({
    where: { themeId_userId: { themeId, userId } },
  });
}

export async function getEntryBySubmission(submissionId: string) {
  return prisma.groupThemeEntry.findUnique({ where: { submissionId } });
}

// Constraint única (themeId, userId) garante uma única participação por
// tema mesmo sob concorrência (FR-017).
export async function createEntry(
  themeId: string,
  userId: string,
  submissionId: string,
  db: Db = prisma,
) {
  try {
    return await db.groupThemeEntry.create({ data: { themeId, userId, submissionId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(
        "ALREADY_ENTERED",
        409,
        "Você já enviou uma redação para o tema deste grupo.",
      );
    }
    throw error;
  }
}

// Libera a vaga quando a submissão é abandonada ou falha.
export async function deleteEntry(submissionId: string): Promise<void> {
  await prisma.groupThemeEntry.deleteMany({ where: { submissionId } });
}

export async function setDisplayAs(submissionId: string, displayAs: GroupDisplayAs) {
  return prisma.groupThemeEntry.update({ where: { submissionId }, data: { displayAs } });
}
