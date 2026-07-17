import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markUploaded } from "@/modules/submissions";

// O OCR roda em segundo plano via after(); a função precisa de folga para concluir
// a transcrição (sobretudo por LLM) depois da resposta ser enviada.
export const maxDuration = 60;

export const POST = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const submission = await markUploaded(user.id, id);
  return NextResponse.json({ status: submission.status, failureReason: submission.failureReason });
});
