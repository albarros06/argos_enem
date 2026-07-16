import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getThemeMetrics } from "@/modules/weekly";

export const dynamic = "force-dynamic";

export const GET = handleRoute<{ id: string }>(async (_request, context) => {
  await requireAdmin();
  const { id } = await context.params;
  return NextResponse.json(await getThemeMetrics(id));
});
