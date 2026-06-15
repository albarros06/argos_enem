import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getParticipationHistory } from "@/modules/weekly";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

// Histórico de participação do aluno em temas encerrados (FR-021).
export const GET = handleRoute(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const { page } = querySchema.parse({ page: url.searchParams.get("page") ?? undefined });
  return NextResponse.json(await getParticipationHistory(user.id, page));
});
