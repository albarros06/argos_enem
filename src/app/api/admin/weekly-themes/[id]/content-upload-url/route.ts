import { NextResponse } from "next/server";
import { ApiError, handleRoute, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getThemeById, presignContentSchema, presignContentUpload } from "@/modules/weekly";

export const dynamic = "force-dynamic";

export const POST = handleRoute<{ id: string }>(async (request, context) => {
  await requireAdmin();
  const { id } = await context.params;
  if (!(await getThemeById(id))) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  const input = await parseBody(request, presignContentSchema);
  return NextResponse.json(await presignContentUpload(id, input));
});
