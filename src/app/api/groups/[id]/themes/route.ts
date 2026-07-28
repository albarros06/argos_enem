import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { requirePremiumUser } from "@/lib/auth";
import { proposeTheme } from "@/modules/groups";

export const dynamic = "force-dynamic";

const proposeSchema = z.object({
  title: z.string().trim().min(1, "Informe o enunciado do tema.").max(2000),
});

export const POST = handleRoute<{ id: string }>(async (request, context) => {
  const user = await requirePremiumUser();
  const { id } = await context.params;
  const { title } = await parseBody(request, proposeSchema);
  const theme = await proposeTheme(id, user.id, title);
  return NextResponse.json(theme, { status: 201 });
});
