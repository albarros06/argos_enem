import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createGroup, listForUser } from "@/modules/groups";

export const dynamic = "force-dynamic";

export const GET = handleRoute(async () => {
  const user = await requireUser();
  return NextResponse.json({ groups: await listForUser(user.id) });
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do grupo.").max(200),
});

export const POST = handleRoute(async (request) => {
  const user = await requireUser();
  const { name } = await parseBody(request, createSchema);
  const group = await createGroup(user.id, name);
  return NextResponse.json(group, { status: 201 });
});
