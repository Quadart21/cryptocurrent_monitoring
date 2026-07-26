import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { syncAllFeeds } from "@/lib/sync-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public sync endpoint locked — use /api/admin/sync with admin session. */
export async function GET(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json(await syncAllFeeds());
}

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json(await syncAllFeeds());
}
