import { NextResponse } from "next/server";
import { readTgImageFile } from "@/lib/telegram/tg-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const file = await readTgImageFile(decoded);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
