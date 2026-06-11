import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { business } from "@/lib/config";
import { storage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import {
  consumeCredit,
  getBalance,
  InsufficientCreditsError,
  refundCredit,
} from "@/modules/credits";
import { extractFromStorage } from "@/modules/transcription";
import { startGrading } from "@/modules/grading";
import { countEssayLines } from "@/lib/text";
import { assertTransition } from "./stateMachine";

export { assertTransition, canTransition } from "./stateMachine";
export { startSubmissionSweep, sweepAbandonedSubmissions } from "./sweep";

export const createSubmissionSchema = z.object({
  themeId: z.string().uuid().optional(),
  themeText: z.string().trim().min(1, "Informe o tema da redação.").max(500),
  imageSha256: z.string().regex(/^[a-f0-9]{64}$/i, "Hash da imagem inválido."),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
  force: z.boolean().optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export async function createSubmission(userId: string, input: CreateSubmissionInput) {
  // Paywall antes de qualquer processamento de upload (FR-021).
  const balance = await getBalance(userId);
  if (balance.freeRemaining + balance.quotaRemaining <= 0) {
    throw new InsufficientCreditsError();
  }

  if (!business.allowedImageTypes.includes(input.contentType)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Formato não suportado. Envie uma foto JPEG ou PNG.",
    );
  }
  if (input.sizeBytes > business.maxUploadBytes) {
    const limitMb = Math.floor(business.maxUploadBytes / (1024 * 1024));
    throw new ApiError("VALIDATION_ERROR", 400, `A imagem excede o limite de ${limitMb} MB.`);
  }

  if (!input.force) {
    const duplicate = await prisma.submission.findFirst({
      where: {
        userId,
        imageSha256: input.imageSha256.toLowerCase(),
        status: { notIn: ["failed", "expired"] },
      },
    });
    if (duplicate) {
      throw new ApiError(
        "DUPLICATE_IMAGE",
        409,
        "Esta foto parece já ter sido enviada. Envie novamente apenas se tiver certeza.",
      );
    }
  }

  let themeText = input.themeText;
  if (input.themeId) {
    const theme = await prisma.essayTheme.findUnique({ where: { id: input.themeId } });
    if (!theme) {
      throw new ApiError("VALIDATION_ERROR", 400, "Tema não encontrado.");
    }
    themeText = theme.title;
  }

  const id = crypto.randomUUID();
  const extension = input.contentType === "image/png" ? "png" : "jpg";
  const imageKey = `essays/${userId}/${id}.${extension}`;

  await prisma.submission.create({
    data: {
      id,
      userId,
      themeId: input.themeId,
      themeText,
      imageKey,
      imageSha256: input.imageSha256.toLowerCase(),
      status: "pending",
    },
  });

  const uploadUrl = await storage().presignUpload(imageKey, input.contentType);
  return { submissionId: id, uploadUrl };
}

// Cliente sinaliza que o upload terminou → roda OCR inline (R6).
// Falha de extração NÃO consome crédito (FR-007) e apaga a imagem (FR-027a).
export async function markUploaded(userId: string, submissionId: string) {
  const submission = await ownedSubmission(userId, submissionId);
  if (submission.status === "awaiting_review") {
    return submission; // chamada repetida — idempotente
  }
  assertTransition(submission.status, "awaiting_review");
  if (!submission.imageKey) {
    throw new ApiError("INVALID_STATE", 409, "Imagem não disponível para extração.");
  }

  const outcome = await extractFromStorage(submission.imageKey);
  if (!outcome.ok) {
    await deleteImage(submission.imageKey);
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "failed", failureReason: outcome.reason, imageKey: null },
    });
  }

  return prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "awaiting_review",
      transcription: {
        create: { rawText: outcome.rawText, meanConfidence: outcome.meanConfidence },
      },
    },
  });
}

// Confirmação: consome o crédito atomicamente, apaga a imagem e inicia a correção
// (clarificação 1, FR-008, FR-027a).
export async function confirmTranscription(
  userId: string,
  submissionId: string,
  confirmedText: string,
) {
  const submission = await ownedSubmission(userId, submissionId);
  assertTransition(submission.status, "grading");
  const transcription = await prisma.transcription.findUnique({
    where: { submissionId: submission.id },
  });
  const rawText = transcription?.rawText ?? "";
  validateConfirmedText(rawText, confirmedText);

  // Reivindica a transição primeiro (à prova de confirmações concorrentes),
  // depois consome o crédito; reverte a reivindicação se não houver saldo.
  const claimed = await prisma.submission.updateMany({
    where: { id: submission.id, status: "awaiting_review" },
    data: { status: "grading" },
  });
  if (claimed.count === 0) {
    throw new ApiError("INVALID_STATE", 409, "Esta submissão já foi confirmada ou abandonada.");
  }

  try {
    await consumeCredit(userId, submission.id);
  } catch (error) {
    await prisma.submission.updateMany({
      where: { id: submission.id, status: "grading" },
      data: { status: "awaiting_review" },
    });
    throw error;
  }

  try {
    await prisma.transcription.update({
      where: { submissionId: submission.id },
      data: { confirmedText, confirmedAt: new Date() },
    });
  } catch (error) {
    await refundCredit(userId, submission.id);
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "failed", failureReason: "grading_failed" },
    });
    throw error;
  }

  if (submission.imageKey) {
    await deleteImage(submission.imageKey);
    await prisma.submission.update({ where: { id: submission.id }, data: { imageKey: null } });
  }

  startGrading(submission.id);
  return prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
}

export async function abandonSubmission(userId: string, submissionId: string) {
  const submission = await ownedSubmission(userId, submissionId);
  assertTransition(submission.status, "expired");
  if (submission.imageKey) {
    await deleteImage(submission.imageKey);
  }
  return prisma.submission.update({
    where: { id: submission.id },
    data: { status: "expired", imageKey: null },
  });
}

export async function getSubmissionView(userId: string, submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      transcription: true,
      evaluation: { include: { annotations: true } },
    },
  });
  if (!submission || submission.userId !== userId) {
    throw new ApiError("NOT_FOUND", 404, "Submissão não encontrada.");
  }

  if (submission.status === "completed" && !submission.resultViewedAt) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { resultViewedAt: new Date() },
    });
  }

  return {
    id: submission.id,
    status: submission.status,
    failureReason: submission.failureReason,
    themeText: submission.themeText,
    createdAt: submission.createdAt,
    transcription: submission.transcription
      ? {
          rawText: submission.transcription.rawText,
          meanConfidence: submission.transcription.meanConfidence,
        }
      : undefined,
    evaluation: submission.evaluation
      ? {
          totalScore: submission.evaluation.totalScore,
          competencies: [1, 2, 3, 4, 5].map((competency) => ({
            competency,
            score:
              submission.evaluation![
                `scoreC${competency}` as "scoreC1" | "scoreC2" | "scoreC3" | "scoreC4" | "scoreC5"
              ],
            justification:
              (submission.evaluation!.justifications as Record<string, string>)[
                String(competency)
              ] ?? "",
          })),
          zeroReason: submission.evaluation.zeroReason,
          generalFeedback: submission.evaluation.generalFeedback,
          confirmedText: submission.transcription?.confirmedText ?? "",
          annotations: submission.evaluation.annotations.map((annotation) => ({
            competency: annotation.competency,
            excerpt: annotation.excerpt,
            startOffset: annotation.startOffset,
            endOffset: annotation.endOffset,
            anchored: annotation.anchored,
            issue: annotation.issue,
            suggestion: annotation.suggestion,
          })),
        }
      : undefined,
  };
}

export async function listSubmissions(userId: string, page: number, pageSize = 20) {
  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { evaluation: { select: { totalScore: true } } },
    }),
    prisma.submission.count({ where: { userId } }),
  ]);
  return {
    items: items.map((submission) => ({
      id: submission.id,
      themeText: submission.themeText,
      status: submission.status,
      totalScore: submission.evaluation?.totalScore ?? null,
      resultReady: submission.status === "completed" && !submission.resultViewedAt,
      createdAt: submission.createdAt,
    })),
    total,
    page,
    pageSize,
  };
}

async function ownedSubmission(userId: string, submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission || submission.userId !== userId) {
    throw new ApiError("NOT_FOUND", 404, "Submissão não encontrada.");
  }
  return submission;
}

function validateConfirmedText(rawText: string, confirmedText: string): void {
  if (countEssayLines(confirmedText) < business.minEssayLines) {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      `O texto confirmado precisa ter pelo menos ${business.minEssayLines} linhas.`,
    );
  }
  const ratio = confirmedText.length / Math.max(rawText.length, 1);
  if (ratio < business.confirmLengthRatioMin || ratio > business.confirmLengthRatioMax) {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "O texto confirmado difere demais do texto extraído. Corrija apenas os erros de leitura.",
    );
  }
}

async function deleteImage(imageKey: string): Promise<void> {
  try {
    await storage().deleteObject(imageKey);
  } catch (error) {
    // Falha ao apagar não bloqueia o fluxo; o sweep tenta de novo depois.
    logger.warn("image_delete_failed", {
      imageKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
