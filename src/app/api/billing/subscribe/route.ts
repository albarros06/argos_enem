import { NextResponse } from "next/server";
import { clientIp, handleRoute, parseBody } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { subscribe, subscribeSchema } from "@/modules/billing";

export const POST = handleRoute(async (request) => {
  const user = await requireVerifiedUser("Confirme seu e-mail antes de assinar um plano.");
  const input = await parseBody(request, subscribeSchema);
  return NextResponse.json(await subscribe(user.id, input, clientIp(request)));
});
