import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { business } from "@/lib/config";
import { scheduleBackgroundTask } from "@/lib/background";
import { countEssayLines } from "@/lib/text";
import { refundCredit } from "@/modules/credits";
import { deleteEntry } from "@/modules/weekly";
import { gradingProvider, type FeedbackInput, type GradingProvider } from "./llm";
import {
  validateEvaluationConsistency,
  type CompetencyNumber,
  type FeedbackResult,
  type LlmEvaluation,
  type ScoringResult,
} from "./schema";
import { anchorAnnotations } from "./anchoring";
import { RUBRIC_VERSION } from "./rubric";

export {
  enqueueFakeGradingResult,
  enqueueFakeScoringResult,
  enqueueFakeFeedbackResult,
  defaultFakeEvaluation,
  defaultFakeScoringResult,
  defaultFakeFeedbackResult,
} from "./llm";
export { anchorAnnotations } from "./anchoring";
export { llmEvaluationSchema } from "./schema";
export { validateEvaluationConsistency, RUBRIC_VERSION };

const COMPETENCIES: CompetencyNumber[] = [1, 2, 3, 4, 5];

// Dispara a correção fora do request. after() (via scheduleBackgroundTask) mantém
// a função viva na Vercel até terminar; falhas são tratadas em evaluateSubmission.
export function startGrading(submissionId: string): void {
  scheduleBackgroundTask("grading", () => evaluateSubmission(submissionId));
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
      evaluation = await gradeInTwoCalls(submission.themeText, confirmedText);
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
          modelId: `score:${business.gradingModelId}+fb:${business.feedbackModelId}`,
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

// Pipeline de duas chamadas (spec 018). A CHAMADA 1 (pontuação) é autoritativa quanto às
// notas e à anulação; a CHAMADA 2 (feedback) explica as notas e classifica o motivo de
// anulação. Uma falha na CHAMADA 1 propaga (o chamador reembolsa e marca failed); uma
// falha na CHAMADA 2 degrada para feedback placeholder — nunca descarta notas válidas.
async function gradeInTwoCalls(theme: string, essayText: string): Promise<LlmEvaluation> {
  const provider = gradingProvider();
  const scoring = await provider.scoreEssay({ theme, essayText });
  const feedback = await feedbackWithFallback(
    provider,
    { theme, essayText, scores: scoring.scores, annulled: scoring.annulled },
    scoring,
  );
  return mergeEvaluation(scoring, feedback);
}

async function feedbackWithFallback(
  provider: GradingProvider,
  input: FeedbackInput,
  scoring: ScoringResult,
): Promise<FeedbackResult> {
  try {
    return await provider.generateFeedback(input);
  } catch (error) {
    // A CHAMADA 2 já tem retry interno (withRetry) para rate-limit; qualquer falha aqui é
    // definitiva — degrada sem descartar as notas válidas nem reembolsar (FR-016).
    logger.warn("feedback_degraded", {
      error: error instanceof Error ? error.message : String(error),
    });
    return degradedFeedback(scoring);
  }
}

function mergeEvaluation(scoring: ScoringResult, feedback: FeedbackResult): LlmEvaluation {
  // A anulação é decidida pela CHAMADA 1; o zeroReason vem da classificação da CHAMADA 2,
  // com default documentado (theme_disconnection) quando anulada sem classificação válida.
  const zeroReason = scoring.annulled ? (feedback.zeroReason ?? "theme_disconnection") : null;
  const competencies = COMPETENCIES.map((competency) => ({
    competency,
    score: scoring.scores[competency],
    justification: feedback.justifications[competency],
  }));
  return validateEvaluationConsistency({
    zeroReason,
    competencies,
    generalFeedback: feedback.generalFeedback,
    annotations: feedback.annotations,
  });
}

// Feedback degradado (spec 018 FR-016): a CHAMADA 2 falhou após os retries. Preserva as
// notas válidas com justificativas placeholder e o default de anulação documentado.
function degradedFeedback(scoring: ScoringResult): FeedbackResult {
  const placeholder =
    "Justificativa detalhada indisponível para esta correção; a nota da competência é definitiva.";
  const justifications = {} as Record<CompetencyNumber, string>;
  for (const competency of COMPETENCIES) {
    justifications[competency] = placeholder;
  }
  return {
    zeroReason: scoring.annulled ? "theme_disconnection" : null,
    justifications,
    generalFeedback:
      "Não foi possível gerar o feedback detalhado automático desta correção. As notas por competência acima são definitivas.",
    annotations: [],
  };
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
