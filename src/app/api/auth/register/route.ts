import { NextResponse } from "next/server";
import { handleRoute, parseBody } from "@/lib/api";
import { assertRateLimit } from "@/lib/rateLimit";
import { registerSchema, registerUser } from "@/modules/auth";

export const POST = handleRoute(async (request) => {
  const input = await parseBody(request, registerSchema);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  assertRateLimit(`register:${ip}`, 10, 60_000);
  const user = await registerUser(input);
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
});
