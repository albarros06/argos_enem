import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requirePaidUser, requirePremiumUser } from "@/lib/auth";
import { deleteGroup, getGroupDetailView, requireGroupMember } from "@/modules/groups";

export const dynamic = "force-dynamic";

export const GET = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requirePaidUser();
  const { id } = await context.params;
  await requireGroupMember(id, user.id);
  return NextResponse.json(await getGroupDetailView(id, user.id));
});

export const DELETE = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requirePremiumUser();
  const { id } = await context.params;
  await deleteGroup(id, user.id);
  return NextResponse.json({ ok: true });
});
