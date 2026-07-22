import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { closeTheme } from "@/modules/groups";

const patchSchema = z.object({ action: z.literal("close") });

export const PATCH = handleRoute<{ id: string; themeId: string }>(async (request, context) => {
  const user = await requireUser();
  const { id, themeId } = await context.params;
  await parseBody(request, patchSchema);
  const theme = await closeTheme(id, user.id, themeId);
  return NextResponse.json(theme);
});
