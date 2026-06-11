import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { cancel } from "@/modules/billing";

export const POST = handleRoute(async () => {
  const user = await requireUser();
  const subscription = await cancel(user.id);
  return NextResponse.json({
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
});
