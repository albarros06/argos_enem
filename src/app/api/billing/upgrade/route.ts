import { NextResponse } from "next/server";
import { clientIp, handleRoute, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { upgrade, upgradeSchema } from "@/modules/billing";

export const POST = handleRoute(async (request) => {
  const user = await requireUser();
  const input = await parseBody(request, upgradeSchema);
  return NextResponse.json(await upgrade(user.id, input, clientIp(request)));
});
