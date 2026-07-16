import crypto from "crypto";
import { z } from "zod";
import type { WeeklyFileKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { storage } from "@/lib/storage";
import { logger } from "@/lib/logger";

const MAX_CONTENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES: Record<WeeklyFileKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  pdf: ["application/pdf"],
};

export const presignContentSchema = z.object({
  fileType: z.enum(["image", "pdf"]),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

// Gera uma URL de upload assinada para um material de apoio. A linha no banco
// só é criada na confirmação (addContent), evitando registros órfãos.
export async function presignContentUpload(
  themeId: string,
  input: z.infer<typeof presignContentSchema>,
) {
  if (!ALLOWED_CONTENT_TYPES[input.fileType].includes(input.contentType)) {
    throw new ApiError("VALIDATION_ERROR", 400, "Formato de arquivo não suportado.");
  }
  if (input.sizeBytes > MAX_CONTENT_BYTES) {
    throw new ApiError("VALIDATION_ERROR", 400, "O arquivo excede o limite de 20 MB.");
  }
  const contentId = crypto.randomUUID();
  const fileKey = `weekly-themes/${themeId}/content/${contentId}`;
  const uploadUrl = await storage().presignUpload(fileKey, input.contentType);
  return { contentId, uploadUrl };
}

export const addContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    body: z.string().trim().min(1, "Informe o texto de apoio."),
    displayOrder: z.number().int().min(0).default(0),
  }),
  z.object({
    kind: z.literal("file"),
    contentId: z.string().uuid(),
    fileType: z.enum(["image", "pdf"]),
    displayOrder: z.number().int().min(0).default(0),
  }),
]);

export async function addContent(themeId: string, input: z.infer<typeof addContentSchema>) {
  if (input.kind === "text") {
    return prisma.weeklyThemeContent.create({
      data: { themeId, kind: "text", body: input.body, displayOrder: input.displayOrder },
    });
  }
  return prisma.weeklyThemeContent.create({
    data: {
      id: input.contentId,
      themeId,
      kind: "file",
      fileKey: `weekly-themes/${themeId}/content/${input.contentId}`,
      fileType: input.fileType,
      displayOrder: input.displayOrder,
    },
  });
}

export async function deleteContent(themeId: string, contentId: string): Promise<void> {
  const content = await prisma.weeklyThemeContent.findUnique({ where: { id: contentId } });
  if (!content || content.themeId !== themeId) {
    throw new ApiError("NOT_FOUND", 404, "Material de apoio não encontrado.");
  }
  if (content.fileKey) {
    try {
      await storage().deleteObject(content.fileKey);
    } catch (error) {
      logger.warn("weekly_content_delete_failed", {
        contentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  await prisma.weeklyThemeContent.delete({ where: { id: contentId } });
}

export interface ContentView {
  id: string;
  kind: "text" | "file";
  body: string | null;
  fileType: WeeklyFileKind | null;
  fileUrl: string | null;
  displayOrder: number;
}

// Materiais de apoio do tema, com URL assinada de leitura para os arquivos.
export async function getThemeContents(themeId: string): Promise<ContentView[]> {
  const contents = await prisma.weeklyThemeContent.findMany({
    where: { themeId },
    orderBy: { displayOrder: "asc" },
  });
  return Promise.all(
    contents.map(async (content) => ({
      id: content.id,
      kind: content.kind,
      body: content.body,
      fileType: content.fileType,
      fileUrl: content.fileKey ? await storage().presignDownload(content.fileKey) : null,
      displayOrder: content.displayOrder,
    })),
  );
}
