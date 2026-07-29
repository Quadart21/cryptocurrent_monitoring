import { NextResponse } from "next/server";
import { getLegalSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public legal texts for consent banner (title/body only). */
export async function GET() {
  const legal = await getLegalSettings();
  return NextResponse.json({
    bannerTitle: legal.bannerTitle,
    bannerBody: legal.bannerBody,
  });
}
