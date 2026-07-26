import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { syncAllFeeds } from "@/lib/sync-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const result = await syncAllFeeds();
  return NextResponse.json(result);
}
