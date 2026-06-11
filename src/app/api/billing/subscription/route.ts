import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getSubscriptionView } from "@/modules/billing";

export const GET = handleRoute(async () => {
  const user = await requireUser();
  return NextResponse.json(await getSubscriptionView(user.id));
});
