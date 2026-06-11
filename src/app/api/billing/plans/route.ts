import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { listActivePlans } from "@/modules/billing";

export const GET = handleRoute(async () => {
  return NextResponse.json(await listActivePlans());
});
