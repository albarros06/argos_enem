import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markUploaded } from "@/modules/submissions";

export const POST = handleRoute<{ id: string }>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const submission = await markUploaded(user.id, id);
  return NextResponse.json({ status: submission.status, failureReason: submission.failureReason });
});
