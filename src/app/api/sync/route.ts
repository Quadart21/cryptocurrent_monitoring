import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { syncAllFeeds } from "@/lib/sync-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mutations only via POST — GET removed (CSRF / accidental sync). */
export async function POST() {
  const denied = await assertAdminResource("sync", "POST");
  if (denied) return denied;
  return NextResponse.json(await syncAllFeeds());
}
