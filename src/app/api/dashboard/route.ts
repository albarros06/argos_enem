import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/modules/dashboard";

export const GET = handleRoute(async () => {
  const user = await requireUser();
  return NextResponse.json(await getDashboard(user.id));
});
