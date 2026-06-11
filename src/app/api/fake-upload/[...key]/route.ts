import { NextResponse } from "next/server";
import { fakeVendorsEnabled } from "@/lib/config";
import { storage } from "@/lib/storage";

// Destino dos uploads "presigned" quando FAKE_VENDORS=1 — só existe em teste/E2E.
export async function PUT(request: Request, context: { params: Promise<{ key: string[] }> }) {
  if (!fakeVendorsEnabled()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Não encontrado." } },
      { status: 404 },
    );
  }
  const { key } = await context.params;
  const objectKey = decodeURIComponent(key.join("/"));
  const bytes = Buffer.from(await request.arrayBuffer());
  await storage().putObject(objectKey, bytes, request.headers.get("content-type") ?? "image/jpeg");
  return new NextResponse(null, { status: 200 });
}
