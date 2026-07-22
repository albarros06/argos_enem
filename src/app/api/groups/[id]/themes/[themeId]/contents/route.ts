import { NextResponse } from "next/server";
import { ApiError, handleRoute, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { addContent, addContentSchema, getThemeById, requireGroupLeader } from "@/modules/groups";

export const dynamic = "force-dynamic";

export const POST = handleRoute<{ id: string; themeId: string }>(async (request, context) => {
  const user = await requireUser();
  const { id, themeId } = await context.params;
  await requireGroupLeader(id, user.id);
  const theme = await getThemeById(themeId);
  if (!theme || theme.groupId !== id) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  const input = await parseBody(request, addContentSchema);
  const content = await addContent(themeId, input);
  return NextResponse.json(content, { status: 201 });
});
