import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { syncCryptoNews } from "@/lib/news/sync-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const denied = await assertAdmin();
  if (denied) return denied;
  try {
    const result = await syncCryptoNews({ force: true });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
