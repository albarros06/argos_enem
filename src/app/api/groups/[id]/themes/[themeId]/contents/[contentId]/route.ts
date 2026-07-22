import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteContent, requireGroupLeader } from "@/modules/groups";

export const DELETE = handleRoute<{ id: string; themeId: string; contentId: string }>(
  async (_request, context) => {
    const user = await requireUser();
    const { id, themeId, contentId } = await context.params;
    await requireGroupLeader(id, user.id);
    await deleteContent(themeId, contentId);
    return NextResponse.json({ ok: true });
  },
);
