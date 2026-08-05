import { NextResponse } from "next/server";
import { readTgImageFile, writeTgImageFile } from "@/lib/telegram/tg-image";
import { workerInternalSecret } from "@/lib/runtime-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function assertSecret(request: Request): boolean {
  const expected = workerInternalSecret();
  if (!expected) return false;
  const got = request.headers.get("x-gapsnap-worker-secret")?.trim() || "";
  return got === expected;
}

/** Worker → web: upload generated TG image bytes. */
export async function PUT(request: Request) {
  if (!assertSecret(request)) return unauthorized();

  const name = (request.headers.get("x-gapsnap-tg-image-name") || "").trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const buf = Buffer.from(await request.arrayBuffer());
  const ok = await writeTgImageFile(name, buf);
  if (!ok) {
    return NextResponse.json({ error: "Write failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, name });
}

/** Web → worker: fetch image bytes when web disk is missing the file. */
export async function GET(request: Request) {
  if (!assertSecret(request)) return unauthorized();

  const name = new URL(request.url).searchParams.get("name")?.trim() || "";
  const file = await readTgImageFile(name);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
