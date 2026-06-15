import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { business } from "@/lib/config";
import { countEssayLines } from "@/lib/text";
import { refundCredit } from "@/modules/credits";
import { deleteEntry } from "@/modules/weekly";
import { gradingProvider } from "./llm";
import { llmEvaluationSchema, validateEvaluationConsistency, type LlmEvaluation } from "./schema";
import { anchorAnnotations } from "./anchoring";
import { RUBRIC_VERSION } from "./rubric";

export { enqueueFakeGradingResult, defaultFakeEvaluation } from "./llm";
export { anchorAnnotations } from "./anchoring";
export { llmEvaluationSchema, validateEvaluationConsistency, RUBRIC_VERSION };

// Dispara o pipeline como tarefa em segundo plano no próprio processo (R6).
// Falhas são tratadas dentro de evaluateSubmission; aqui só garantimos que a
// promise nunca rejeite sem log.
export function startGrading(submissionId: string): void {
  void evaluateSubmission(submissionId).catch((error) => {
    logger.error("grading_task_crashed", {
      submissionId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function evaluateSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { transcription: true },
  });
  if (!submission || submission.status !== "grading") {
    logger.warn("grading_skipped_invalid_state", { submissionId, status: submission?.status });
    return;
  }
  const confirmedText = submission.transcription?.confirmedText;
  if (!confirmedText) {
    logger.error("grading_missing_confirmed_text", { submissionId });
    await failSubmission(submission.id, submission.userId);
    return;
  }

  try {
    let evaluation: LlmEvaluation;
    if (countEssayLines(confirmedText) < business.minEssayLines) {
      // Condição de zero detectável em código — não gasta chamada de LLM (R9).
      evaluation = insufficientTextEvaluation();
    } else {
      const raw = await gradingProvider().grade({
        theme: submission.themeText,
        essayText: confirmedText,
      });
      evaluation = validateEvaluationConsistency(llmEvaluationSchema.parse(raw));
    }

    const anchored = anchorAnnotations(confirmedText, evaluation.annotations);
    if (!evaluation.zeroReason && anchored.length < 3) {
      logger.warn("low_annotation_count", { submissionId, count: anchored.length }); // SC-005
    }

    const scores = new Map(evaluation.competencies.map((c) => [c.competency, c.score]));
    const totalScore = evaluation.competencies.reduce((sum, c) => sum + c.score, 0);

    await prisma.$transaction(async (tx) => {
      await tx.evaluation.create({
        data: {
          submissionId: submission.id,
          scoreC1: scores.get(1)!,
          scoreC2: scores.get(2)!,
          scoreC3: scores.get(3)!,
          scoreC4: scores.get(4)!,
          scoreC5: scores.get(5)!,
          totalScore,
          justifications: Object.fromEntries(
            evaluation.competencies.map((c) => [c.competency, c.justification]),
          ),
          generalFeedback: evaluation.generalFeedback,
          zeroReason: evaluation.zeroReason,
          rubricVersion: RUBRIC_VERSION,
          modelId: business.gradingModelId,
          annotations: {
            create: anchored.map((annotation) => ({
              competency: annotation.competency,
              excerpt: annotation.excerpt,
              startOffset: annotation.startOffset,
              endOffset: annotation.endOffset,
              anchored: annotation.anchored,
              issue: annotation.issue,
              suggestion: annotation.suggestion,
            })),
          },
        },
      });
      await tx.submission.update({
        where: { id: submission.id },
        data: { status: "completed" },
      });
    });
    logger.info("grading_completed", { submissionId, totalScore });
  } catch (error) {
    logger.error("grading_failed", {
      submissionId,
      error: error instanceof Error ? error.message : String(error),
    });
    await failSubmission(submission.id, submission.userId);
  }
}

// FR-015: falha após consumo de crédito → devolve o crédito e marca como failed.
// Uma redação que falhou na correção não entra no ranking; a vaga no tema da
// semana é liberada (a submissão excluída deixa de bloquear nova participação).
async function failSubmission(submissionId: string, userId: string): Promise<void> {
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "failed", failureReason: "grading_failed" },
  });
  await refundCredit(userId, submissionId);
  await deleteEntry(submissionId);
}

function insufficientTextEvaluation(): LlmEvaluation {
  const justification =
    "Texto com menos linhas que o mínimo exigido — condição oficial de nota zero (texto insuficiente).";
  return {
    zeroReason: "insufficient_text",
    competencies: [1, 2, 3, 4, 5].map((competency) => ({
      competency: competency as 1 | 2 | 3 | 4 | 5,
      score: 0,
      justification,
    })),
    generalFeedback:
      "Sua redação recebeu nota zero por texto insuficiente: o ENEM exige no mínimo 7 linhas escritas. Desenvolva introdução, argumentação e conclusão para que o texto possa ser avaliado nas 5 competências.",
    annotations: [],
  };
}
