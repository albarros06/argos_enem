import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getBalance } from "@/modules/credits";

export const GET = handleRoute(async () => {
  const user = await requireUser();
  const balance = await getBalance(user.id);
  return NextResponse.json({
    freeRemaining: balance.freeRemaining,
    quotaRemaining: balance.quotaRemaining,
    cycleEndsAt: balance.cycleEndsAt,
  });
});
