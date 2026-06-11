import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { passwordSchema, resetPassword } from "@/modules/auth";

const schema = z.object({ token: z.string().min(1), newPassword: passwordSchema });

export const POST = handleRoute(async (request) => {
  const { token, newPassword } = await parseBody(request, schema);
  await resetPassword(token, newPassword);
  return NextResponse.json({ ok: true });
});
