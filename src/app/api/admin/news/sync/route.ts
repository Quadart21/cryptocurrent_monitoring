import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  isNewsSyncInFlight,
  startNewsSync,
} from "@/lib/news/sync-news";
import { getNewsSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  const settings = await getNewsSettings();
  return NextResponse.json({
    inFlight: isNewsSyncInFlight(),
    lastSyncAt: settings.lastSyncAt,
    lastSyncResult: settings.lastSyncResult,
  });
}

export async function POST() {
  const denied = await assertAdmin();
  if (denied) return denied;
  try {
    const started = await startNewsSync({ force: true });
    return NextResponse.json({
      ok: true,
      started: true,
      alreadyRunning: started.alreadyRunning,
      inFlight: true,
      message: started.alreadyRunning
        ? "Синхронизация уже выполняется"
        : "Синхронизация запущена в фоне",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
