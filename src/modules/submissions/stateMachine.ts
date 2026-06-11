import type { SubmissionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api";

// Máquina de estados da submissão — fonte única de verdade (data-model):
// pending ──extração ok──▶ awaiting_review ──confirmação──▶ grading ──ok──▶ completed
//    │ extração falha            │ abandono/sweep                │ falha LLM
//    ▼                           ▼                               ▼
//  failed                     expired                         failed (crédito devolvido)
const transitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  pending: ["awaiting_review", "failed", "expired"],
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
