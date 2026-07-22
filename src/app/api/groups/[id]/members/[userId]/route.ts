import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { removeMember } from "@/modules/groups";

export const DELETE = handleRoute<{ id: string; userId: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id, userId } = await context.params;
  await removeMember(id, user.id, userId);
  return NextResponse.json({ ok: true });
});
