import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteGroup, getGroupDetailView, requireGroupMember } from "@/modules/groups";

export const dynamic = "force-dynamic";

export const GET = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await requireGroupMember(id, user.id);
  return NextResponse.json(await getGroupDetailView(id, user.id));
});

export const DELETE = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await deleteGroup(id, user.id);
  return NextResponse.json({ ok: true });
});
