import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getAppMetrics } from "@/modules/weekly";

export const dynamic = "force-dynamic";

export const GET = handleRoute(async () => {
  await requireAdmin();
  return NextResponse.json(await getAppMetrics());
});
