import { NextResponse } from "next/server";
import { ApiError, handleRoute } from "@/lib/api";
import { getActiveThemeView } from "@/modules/weekly";

export const dynamic = "force-dynamic";

// Ranking público do tema ativo — acessível a qualquer visitante (FR-015).
export const GET = handleRoute(async () => {
  const view = await getActiveThemeView();
  if (!view) {
    throw new ApiError("NO_ACTIVE_THEME", 404, "Não há tema ativo no momento.");
  }
  return NextResponse.json(view);
});
