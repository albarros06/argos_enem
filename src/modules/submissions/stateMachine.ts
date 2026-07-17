import type { SubmissionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api";

// Máquina de estados da submissão — fonte única de verdade (data-model):
// pending ─upload─▶ transcribing ─OCR ok─▶ awaiting_review ─confirmação─▶ grading ─ok─▶ completed
//    │ abandono          │ OCR falha            │ abandono/sweep              │ falha LLM
//    ▼                   ▼                      ▼                             ▼
//  expired             failed                 expired                      failed (crédito devolvido)
// O OCR roda em segundo plano (transcribing): markUploaded reivindica o estado e
// retorna na hora; a transcrição termina fora do request e move para awaiting_review.
const transitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  pending: ["transcribing", "failed", "expired"],
  transcribing: ["awaiting_review", "failed", "expired"],
  awaiting_review: ["grading", "expired"],
  grading: ["completed", "failed"],
  completed: [],
  failed: [],
  expired: [],
};

export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: SubmissionStatus, to: SubmissionStatus): void {
  if (!canTransition(from, to)) {
    throw new ApiError(
      "INVALID_STATE",
      409,
      `Ação não permitida no estado atual da submissão (${from}).`,
    );
  }
}
