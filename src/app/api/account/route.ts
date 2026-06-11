import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requestAccountDeletion } from "@/modules/auth/deletion";

// LGPD: exclusão de conta e dados (FR-028) — 202 e job assíncrono.
export const DELETE = handleRoute(async () => {
  const user = await requireUser();
  await requestAccountDeletion(user.id);
  return NextResponse.json({ accepted: true }, { status: 202 });
});
