import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { verifyEmail } from "@/modules/auth";

const schema = z.object({ token: z.string().min(1) });

export const POST = handleRoute(async (request) => {
  const { token } = await parseBody(request, schema);
  await verifyEmail(token);
  return NextResponse.json({ ok: true });
});
