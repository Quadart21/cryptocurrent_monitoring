import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  getNewsSyncStatus,
  startNewsSync,
} from "@/lib/news/sync-news";
import { maybeProxyToWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdminResource("blog", "GET");
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
  const denied = await assertAdminResource("blog", "POST");
  if (denied) return denied;
  try {
    const proxied = await maybeProxyToWorker("news", { force: true });
    if (proxied.mode === "proxied") {
      const data = proxied.data as {
        alreadyRunning?: boolean;
        error?: string;
      };
      if (proxied.status >= 400) {
        return NextResponse.json(data, { status: proxied.status });
      }
      return NextResponse.json({
        ok: true,
        started: true,
        alreadyRunning: Boolean(data.alreadyRunning),
        inFlight: true,
        via: "worker",
        message: data.alreadyRunning
          ? "Синхронизация уже выполняется"
          : "Синхронизация запущена на worker",
      });
    }

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
