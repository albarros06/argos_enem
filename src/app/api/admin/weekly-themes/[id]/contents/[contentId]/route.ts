import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { deleteContent } from "@/modules/weekly";

export const dynamic = "force-dynamic";

export const DELETE = handleRoute<{ id: string; contentId: string }>(
  async (_request, context) => {
    await requireAdmin();
    const { id, contentId } = await context.params;
    await deleteContent(id, contentId);
    return NextResponse.json({ ok: true });
  },
);
