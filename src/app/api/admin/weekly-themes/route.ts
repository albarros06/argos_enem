import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listThemes, publishTheme } from "@/modules/weekly";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const GET = handleRoute(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const { page } = listQuerySchema.parse({ page: url.searchParams.get("page") ?? undefined });
  return NextResponse.json(await listThemes(page));
});

const createSchema = z.object({
  title: z.string().trim().min(1, "Informe o enunciado do tema.").max(2000),
  durationDays: z.number().int().min(1).max(60).optional(),
});

export const POST = handleRoute(async (request) => {
  const admin = await requireAdmin();
  const { title, durationDays } = await parseBody(request, createSchema);
  const theme = await publishTheme(admin.id, title, durationDays);
  return NextResponse.json(theme, { status: 201 });
});
