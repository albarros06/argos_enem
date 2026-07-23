import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { assertRateLimit } from "@/lib/rateLimit";
import { resendVerification } from "@/modules/auth";

const schema = z.object({ email: z.string().email() });

export const POST = handleRoute(async (request) => {
  const { email } = await parseBody(request, schema);
  await assertRateLimit(`resend-verification:${email.toLowerCase()}`, 1, 60_000);
  await resendVerification(email);
  return NextResponse.json({ ok: true });
});
