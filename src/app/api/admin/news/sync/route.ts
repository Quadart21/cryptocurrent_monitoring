import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  getNewsSyncStatus,
  startNewsSync,
} from "@/lib/news/sync-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  try {
    const status = await getNewsSyncStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "status failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
