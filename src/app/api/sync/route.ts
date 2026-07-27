import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { syncAllFeeds } from "@/lib/sync-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mutations only via POST — GET removed (CSRF / accidental sync). */
export async function POST() {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json(await syncAllFeeds());
}
