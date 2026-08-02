import { NextResponse } from "next/server";
import { recomputeAllAchievements } from "@/lib/achievements-auto";
import { runBannerChecks } from "@/lib/banner-check";
import { runCatalogDiscovery } from "@/lib/bestchange/sync-catalogs";
import { startNewsSync } from "@/lib/news/sync-news";
import {
  getGapsnapRole,
  isWorkerRole,
  workerInternalSecret,
} from "@/lib/runtime-role";
import { syncAllFeeds, syncExchangerFeed } from "@/lib/sync-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function assertWorkerSecret(request: Request): boolean {
  const expected = workerInternalSecret();
  if (!expected) return false;
  const got = request.headers.get("x-gapsnap-worker-secret")?.trim() || "";
  return got.length > 0 && got === expected;
}

/** Lightweight liveness for load balancers / web→worker checks. */
export async function GET(request: Request) {
  if (!assertWorkerSecret(request) && getGapsnapRole() !== "all") {
    // Allow unauthenticated health only on dedicated worker with secret unset
    // during bootstrap — prefer secret. Without secret: role probe only.
    if (workerInternalSecret()) return unauthorized();
  }
  return NextResponse.json({
    ok: true,
    role: getGapsnapRole(),
    worker: isWorkerRole(),
  });
}

export async function POST(request: Request) {
  if (!assertWorkerSecret(request)) return unauthorized();
  if (!isWorkerRole()) {
    return NextResponse.json(
      {
        error:
          "This node is not a worker (GAPSNAP_ROLE=web). Point WORKER_URL at the worker host.",
      },
      { status: 503 },
    );
  }

  let body: {
    action?: string;
    exchangerId?: string;
    force?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const action = body.action ?? "feeds";

  try {
    if (action === "health") {
      return NextResponse.json({
        ok: true,
        role: getGapsnapRole(),
        worker: true,
      });
    }
    if (action === "feeds") {
      return NextResponse.json({
        action: "feeds",
        ...(await syncAllFeeds()),
      });
    }
    if (action === "feed") {
      const id = body.exchangerId?.trim();
      if (!id) {
        return NextResponse.json(
          { error: "exchangerId required" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        action: "feed",
        ...(await syncExchangerFeed(id)),
      });
    }
    if (action === "catalogs") {
      return NextResponse.json({
        action: "catalogs",
        ...(await runCatalogDiscovery()),
      });
    }
    if (action === "news") {
      const started = await startNewsSync({ force: body.force !== false });
      return NextResponse.json({
        action: "news",
        ok: true,
        started: true,
        alreadyRunning: started.alreadyRunning,
      });
    }
    if (action === "banners") {
      const result = await runBannerChecks({
        exchangerId: body.exchangerId?.trim() || undefined,
      });
      return NextResponse.json({ action: "banners", ...result });
    }
    if (action === "achievements") {
      const result = await recomputeAllAchievements({ dryRun: false });
      return NextResponse.json({ action: "achievements", ...result });
    }
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
