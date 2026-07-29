import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { requirePaidUser } from "@/lib/auth";
import { joinGroup } from "@/modules/groups";

const joinSchema = z.object({
  inviteCode: z.string().trim().min(1, "Informe o código de convite."),
});

export const POST = handleRoute(async (request) => {
  const user = await requirePaidUser();
  const { inviteCode } = await parseBody(request, joinSchema);
  const group = await joinGroup(user.id, inviteCode);
  return NextResponse.json(group);
});
