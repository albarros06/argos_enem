import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { closeTheme, extendTheme, getThemeById, getThemeContents } from "@/modules/weekly";

export const dynamic = "force-dynamic";

export const GET = handleRoute<{ id: string }>(async (_request, context) => {
  await requireAdmin();
  const { id } = await context.params;
  const theme = await getThemeById(id);
  if (!theme) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  const contents = await getThemeContents(id);
  return NextResponse.json({ ...theme, contents });
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extend"), endsAt: z.coerce.date() }),
  z.object({ action: z.literal("close") }),
]);

export const PATCH = handleRoute<{ id: string }>(async (request, context) => {
  await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, patchSchema);
  const theme =
    input.action === "extend" ? await extendTheme(id, input.endsAt) : await closeTheme(id);
  return NextResponse.json(theme);
});
