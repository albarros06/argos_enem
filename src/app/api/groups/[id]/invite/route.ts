import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requirePremiumUser } from "@/lib/auth";
import { regenerateInvite } from "@/modules/groups";

export const POST = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requirePremiumUser();
  const { id } = await context.params;
  const group = await regenerateInvite(id, user.id);
  return NextResponse.json({ inviteCode: group.inviteCode });
});
