import { NextResponse } from "next/server";
import { ApiError, handleRoute, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { addContent, addContentSchema, getThemeById } from "@/modules/weekly";

export const dynamic = "force-dynamic";

export const POST = handleRoute<{ id: string }>(async (request, context) => {
  await requireAdmin();
  const { id } = await context.params;
  if (!(await getThemeById(id))) {
    throw new ApiError("NOT_FOUND", 404, "Tema não encontrado.");
  }
  const input = await parseBody(request, addContentSchema);
  const content = await addContent(id, input);
  return NextResponse.json(content, { status: 201 });
});
