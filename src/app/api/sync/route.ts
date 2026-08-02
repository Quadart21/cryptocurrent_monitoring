import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { syncAllFeeds } from "@/lib/sync-feeds";
import { maybeProxyToWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Mutations only via POST — GET removed (CSRF / accidental sync). */
export async function POST() {
  const denied = await assertAdminResource("sync", "POST");
  if (denied) return denied;
  const proxied = await maybeProxyToWorker("feeds");
  if (proxied.mode === "proxied") {
    return NextResponse.json(proxied.data, { status: proxied.status });
  }
  return NextResponse.json(await syncAllFeeds());
}
