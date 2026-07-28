import { NextResponse } from "next/server";
import { getDb } from "@/db/index";
import { exchangers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badgeSvg(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="88" height="31" viewBox="0 0 88 31" role="img" aria-label="GapSnap">
  <rect width="88" height="31" rx="4" fill="#0f766e"/>
  <rect x="1" y="1" width="86" height="29" rx="3" fill="none" stroke="#99f6e4" stroke-width="1"/>
  <text x="44" y="14" text-anchor="middle" fill="#ecfdf5" font-family="Segoe UI,Arial,sans-serif" font-size="10" font-weight="700">GapSnap</text>
  <text x="44" y="24" text-anchor="middle" fill="#a7f3d0" font-family="Segoe UI,Arial,sans-serif" font-size="7">мониторинг</text>
</svg>`;
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

  return new NextResponse(badgeSvg(), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
