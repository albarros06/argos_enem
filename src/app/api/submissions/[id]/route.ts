import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { abandonSubmission, getSubmissionView } from "@/modules/submissions";

export const GET = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  return NextResponse.json(await getSubmissionView(user.id, id));
});

export const DELETE = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await abandonSubmission(user.id, id);
  return NextResponse.json({ ok: true });
});
