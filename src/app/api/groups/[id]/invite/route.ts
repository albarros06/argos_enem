import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { regenerateInvite } from "@/modules/groups";

export const POST = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const group = await regenerateInvite(id, user.id);
  return NextResponse.json({ inviteCode: group.inviteCode });
});
