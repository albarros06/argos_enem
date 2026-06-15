import { NextResponse } from "next/server";
import { ApiError, handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getMyActiveEntryView } from "@/modules/weekly";

export const dynamic = "force-dynamic";

// Colocação do próprio aluno no tema ativo, mesmo fora do top 50 (FR-017).
export const GET = handleRoute(async () => {
  const user = await requireUser();
  const result = await getMyActiveEntryView(user.id);
  if (result.status === "no_theme") {
    throw new ApiError("NO_ACTIVE_THEME", 404, "Não há tema ativo no momento.");
  }
  if (result.status === "no_entry") {
    throw new ApiError("NOT_FOUND", 404, "Você não participou do tema desta semana.");
  }
  return NextResponse.json({
    submissionId: result.submissionId,
    submissionStatus: result.submissionStatus,
    totalScore: result.totalScore,
    rank: result.rank,
    totalParticipants: result.totalParticipants,
    displayAs: result.displayAs,
  });
});
