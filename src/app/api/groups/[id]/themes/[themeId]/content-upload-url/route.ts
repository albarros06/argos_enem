import { NextResponse } from "next/server";
import { ApiError, handleRoute, parseBody } from "@/lib/api";
import { requirePremiumUser } from "@/lib/auth";
import {
  getThemeById,
  presignContentSchema,
  presignContentUpload,
  requireGroupLeader,
} from "@/modules/groups";

export const dynamic = "force-dynamic";

export const POST = handleRoute<{ id: string; themeId: string }>(async (request, context) => {
  const user = await requirePremiumUser();
  const { id, themeId } = await context.params;
  await requireGroupLeader(id, user.id);
  const theme = await getThemeById(themeId);
  if (!theme || theme.groupId !== id) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  const input = await parseBody(request, presignContentSchema);
  return NextResponse.json(await presignContentUpload(themeId, input));
});
