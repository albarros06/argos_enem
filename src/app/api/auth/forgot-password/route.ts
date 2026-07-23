import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { assertRateLimit } from "@/lib/rateLimit";
import { requestPasswordReset } from "@/modules/auth";

const schema = z.object({ email: z.string().email() });

// Always responds 200 — no account enumeration (contract).
export const POST = handleRoute(async (request) => {
  const { email } = await parseBody(request, schema);
  await assertRateLimit(`forgot-password:${email.toLowerCase()}`, 3, 60_000);
  await requestPasswordReset(email);
  return NextResponse.json({ ok: true });
});
