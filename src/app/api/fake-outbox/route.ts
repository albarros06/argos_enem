import { NextResponse } from "next/server";
import { fakeVendorsEnabled } from "@/lib/config";
import { fakeOutbox } from "@/lib/email";

// Caixa de saída dos e-mails fake quando FAKE_VENDORS=1 — só existe em teste/E2E.
export async function GET(request: Request) {
  if (!fakeVendorsEnabled()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Não encontrado." } },
      { status: 404 },
    );
  }
  const to = new URL(request.url).searchParams.get("to");
  const messages = to ? fakeOutbox().filter((message) => message.to === to) : fakeOutbox();
  return NextResponse.json({ messages });
}
