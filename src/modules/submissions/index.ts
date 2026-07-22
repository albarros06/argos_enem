import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { business } from "@/lib/config";
import { storage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { scheduleBackgroundTask } from "@/lib/background";
import {
  consumeCredit,
  getBalance,
  InsufficientCreditsError,
  refundCredit,
} from "@/modules/credits";
import { extractFromStorage } from "@/modules/transcription";
import { startGrading } from "@/modules/grading";
import { getActiveTier } from "@/modules/billing";
import {
  getActiveTheme,
  getEntryByUserAndTheme,
  getEntryBySubmission,
  createEntry,
  deleteEntry,
  setDisplayAs,
} from "@/modules/weekly";
import {
  requireGroupMember,
  getThemeById as getGroupThemeById,
  getEntryByUserAndTheme as getGroupEntryByUserAndTheme,
  getEntryBySubmission as getGroupEntryBySubmission,
  createEntry as createGroupEntry,
  deleteEntry as deleteGroupEntry,
  setDisplayAs as setGroupDisplayAs,
} from "@/modules/groups";
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
  weeklyThemeId: z.string().uuid().optional(),
  groupThemeId: z.string().uuid().optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export async function createSubmission(userId: string, input: CreateSubmissionInput) {
  if (input.weeklyThemeId && input.groupThemeId) {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Escolha apenas um tipo de tema: da semana ou de um grupo.",
    );
  }

  // Participação na redação da semana: exclusiva de assinantes premium, tema
  // ativo e uma única submissão por tema (FR-009, FR-010, FR-012). Verificado
  // antes do paywall para que não-premium recebam a mensagem correta.
  let weeklyThemeId: string | undefined;
  let weeklyThemeTitle: string | undefined;
  if (input.weeklyThemeId) {
    if ((await getActiveTier(userId)) !== "premium") {
      throw new ApiError(
        "PREMIUM_REQUIRED",
        402,
        "A redação da semana é exclusiva para assinantes do plano premium.",
      );
    }
    const activeTheme = await getActiveTheme();
    if (!activeTheme || activeTheme.id !== input.weeklyThemeId) {
      throw new ApiError("THEME_NOT_ACTIVE", 409, "O tema desta semana não está mais ativo.");
    }
    if (await getEntryByUserAndTheme(activeTheme.id, userId)) {
      throw new ApiError(
        "ALREADY_ENTERED",
        409,
        "Você já enviou uma redação para o tema desta semana.",
      );
    }
    weeklyThemeId = activeTheme.id;
    weeklyThemeTitle = activeTheme.title;
  }

  // Participação em tema de grupo: exige apenas ser membro do grupo (líder ou
  // convidado) — sem restrição de plano, mesma regra de crédito de qualquer
  // submissão regular (FR-015, FR-016, FR-017).
  let groupThemeId: string | undefined;
  let groupThemeTitle: string | undefined;
  if (input.groupThemeId) {
    const theme = await getGroupThemeById(input.groupThemeId);
    if (!theme || theme.status !== "active") {
      throw new ApiError("THEME_NOT_ACTIVE", 409, "O tema deste grupo não está mais ativo.");
    }
    await requireGroupMember(theme.groupId, userId);
    if (await getGroupEntryByUserAndTheme(theme.id, userId)) {
      throw new ApiError(
        "ALREADY_ENTERED",
        409,
        "Você já enviou uma redação para o tema deste grupo.",
      );
    }
    groupThemeId = theme.id;
    groupThemeTitle = theme.title;
  }

  // Paywall antes de qualquer processamento de upload (FR-021).
  const balance = await getBalance(userId);
  if (balance.freeRemaining + balance.quotaRemaining <= 0) {
    throw new InsufficientCreditsError();
  }

  if (!business.allowedUploadTypes.includes(input.contentType)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Formato não suportado. Envie uma foto JPEG, PNG ou um arquivo PDF.",
    );
  }
  if (input.sizeBytes > business.maxUploadBytes) {
    const limitMb = Math.floor(business.maxUploadBytes / (1024 * 1024));
    throw new ApiError("VALIDATION_ERROR", 400, `O arquivo excede o limite de ${limitMb} MB.`);
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
  // O tema da redação da semana ou do grupo define o enunciado da submissão.
  if (weeklyThemeTitle) {
    themeText = weeklyThemeTitle;
  } else if (groupThemeTitle) {
    themeText = groupThemeTitle;
  }

  const id = crypto.randomUUID();
  const imageKey = `essays/${userId}/${id}.${extensionFor(input.contentType)}`;

  // A submissão e o vínculo com o tema (semana ou grupo) são criados juntos
  // para que a constraint única reserve a vaga já no início do fluxo (FR-012,
  // FR-017).
  await prisma.$transaction(async (tx) => {
    await tx.submission.create({
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
    if (weeklyThemeId) {
      await createEntry(weeklyThemeId, userId, id, tx);
    }
    if (groupThemeId) {
      await createGroupEntry(groupThemeId, userId, id, tx);
    }
  });

  const uploadUrl = await storage().presignUpload(imageKey, input.contentType);
  return { submissionId: id, uploadUrl };
}

// Cliente sinaliza que o upload terminou → reivindica o estado transcribing e
// dispara o OCR em segundo plano. A transcrição (sobretudo por LLM) leva segundos;
// rodá-la inline no request estourava o timeout da função. O cliente acompanha a
// submissão por polling até awaiting_review (ou failed).
export async function markUploaded(userId: string, submissionId: string) {
  const submission = await ownedSubmission(userId, submissionId);
  // Idempotente: chamadas repetidas não reprocessam nem reagendam.
  if (submission.status === "transcribing" || submission.status === "awaiting_review") {
    return submission;
  }
  assertTransition(submission.status, "transcribing");
  if (!submission.imageKey) {
    throw new ApiError("INVALID_STATE", 409, "Imagem não disponível para extração.");
  }

  // Reivindica a transição (à prova de /uploaded concorrentes) antes de agendar;
  // só quem efetivamente reivindicou dispara o OCR.
  const claimed = await prisma.submission.updateMany({
    where: { id: submission.id, status: "pending" },
    data: { status: "transcribing" },
  });
  if (claimed.count === 0) {
    return prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
  }

  startTranscription(submission.id);
  return prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
}

// Dispara o OCR fora do request (after() em produção; ver scheduleBackgroundTask).
export function startTranscription(submissionId: string): void {
  scheduleBackgroundTask("transcription", () => transcribeSubmission(submissionId));
}

// OCR em segundo plano: extrai o texto e move para awaiting_review, ou marca failed.
// Falha NÃO consome crédito (FR-007), apaga a imagem (FR-027a) e libera a vaga no
// tema da semana. Reentrante: só age sobre uma submissão ainda em transcribing.
export async function transcribeSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.status !== "transcribing" || !submission.imageKey) {
    logger.warn("transcription_skipped_invalid_state", {
      submissionId,
      status: submission?.status,
    });
    return;
  }

  const outcome = await extractFromStorage(submission.imageKey);
  if (!outcome.ok) {
    await deleteImage(submission.imageKey);
    await deleteEntry(submission.id);
    await deleteGroupEntry(submission.id);
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "failed", failureReason: outcome.reason, imageKey: null },
    });
    return;
  }

  await prisma.submission.update({
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
  weeklyDisplayAs?: "real" | "anonymous",
  groupDisplayAs?: "real" | "anonymous",
) {
  const submission = await ownedSubmission(userId, submissionId);
  assertTransition(submission.status, "grading");
  const transcription = await prisma.transcription.findUnique({
    where: { submissionId: submission.id },
  });
  const rawText = transcription?.rawText ?? "";
  validateConfirmedText(rawText, confirmedText);

  // Submissão vinculada a um tema (semana ou grupo) exige a escolha de
  // exibição no ranking (nome ou anônimo) na confirmação (FR-013, FR-018).
  const weeklyEntry = await getEntryBySubmission(submission.id);
  if (weeklyEntry && !weeklyDisplayAs) {
    throw new ApiError(
      "DISPLAY_AS_REQUIRED",
      400,
      "Escolha como deseja aparecer no ranking: com seu nome ou de forma anônima.",
    );
  }
  const groupEntry = await getGroupEntryBySubmission(submission.id);
  if (groupEntry && !groupDisplayAs) {
    throw new ApiError(
      "DISPLAY_AS_REQUIRED",
      400,
      "Escolha como deseja aparecer no ranking do grupo: com seu nome ou de forma anônima.",
    );
  }

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

  if (weeklyEntry && weeklyDisplayAs) {
    await setDisplayAs(submission.id, weeklyDisplayAs);
  }
  if (groupEntry && groupDisplayAs) {
    await setGroupDisplayAs(submission.id, groupDisplayAs);
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
  // Abandono libera a vaga no tema da semana ou do grupo (FR-012, FR-017).
  await deleteEntry(submission.id);
  await deleteGroupEntry(submission.id);
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
      weeklyEntry: { include: { theme: { select: { title: true } } } },
      groupEntry: { include: { theme: { select: { title: true, groupId: true } } } },
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
    weekly: submission.weeklyEntry
      ? { themeTitle: submission.weeklyEntry.theme.title, displayAs: submission.weeklyEntry.displayAs }
      : null,
    group: submission.groupEntry
      ? {
          groupId: submission.groupEntry.theme.groupId,
          themeTitle: submission.groupEntry.theme.title,
          displayAs: submission.groupEntry.displayAs,
        }
      : null,
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

// O sufixo da chave no storage identifica o tipo do arquivo enviado; a extração
// roteia foto vs. PDF por ele (ver extractFromStorage).
function extensionFor(contentType: string): string {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "png";
  return "jpg";
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
