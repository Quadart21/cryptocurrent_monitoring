import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getDb } from "@/db/index";
import { exchangers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BADGE_PNG_PATH = path.join(
  process.cwd(),
  "public",
  "badge",
  "gapsnap-button.png",
);

let cachedBadge: Buffer | null = null;

async function badgePng(): Promise<Buffer> {
  if (cachedBadge) return cachedBadge;
  cachedBadge = await readFile(BADGE_PNG_PATH);
  return cachedBadge;
}

type Props = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  const clean = decodeURIComponent(token ?? "").trim();
  if (!/^gs_[a-f0-9]{24}$/i.test(clean)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const db = getDb();
  const [row] = await db
    .select({ id: exchangers.id })
    .from(exchangers)
    .where(eq(exchangers.bannerToken, clean))
    .limit(1);
  if (!row) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const png = await badgePng();
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Badge asset missing", { status: 500 });
  }
}
