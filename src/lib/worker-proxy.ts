import "server-only";

import { syncExchangerFeed } from "@/lib/sync-feeds";
import {
  getGapsnapRole,
  workerBaseUrl,
  workerInternalSecret,
  workerProxyConfigured,
} from "@/lib/runtime-role";

export type WorkerAction =
  | "feeds"
  | "feed"
  | "catalogs"
  | "news"
  | "banners"
  | "achievements"
  | "health";

type WorkerProxyResult =
  | { mode: "local" }
  | { mode: "proxied"; data: unknown; status: number };

/**
 * On `web` role with WORKER_URL + WORKER_INTERNAL_SECRET, forward heavy jobs
 * to the worker. Otherwise the caller should run the work locally.
 */
export async function maybeProxyToWorker(
  action: WorkerAction,
  body?: Record<string, unknown>,
): Promise<WorkerProxyResult> {
  const role = getGapsnapRole();
  if (role !== "web" || !workerProxyConfigured()) {
    return { mode: "local" };
  }

  const url = `${workerBaseUrl()}/api/internal/worker`;
  const secret = workerInternalSecret();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gapsnap-worker-secret": secret,
      },
      body: JSON.stringify({ action, ...(body ?? {}) }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({
      error: `worker HTTP ${res.status}`,
    }));
    return { mode: "proxied", data, status: res.status };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "worker unreachable";
    return {
      mode: "proxied",
      status: 502,
      data: { error: `Worker unavailable: ${message}` },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Sync one exchanger feed locally or via worker proxy. */
export async function syncExchangerFeedRouted(exchangerId: string): Promise<{
  ok: boolean;
  pairCount: number;
  error?: string;
}> {
  const proxied = await maybeProxyToWorker("feed", { exchangerId });
  if (proxied.mode === "proxied") {
    const data = proxied.data as {
      ok?: boolean;
      pairCount?: number;
      error?: string;
    };
    if (proxied.status >= 400) {
      return {
        ok: false,
        pairCount: 0,
        error: data.error || `worker HTTP ${proxied.status}`,
      };
    }
    return {
      ok: Boolean(data.ok),
      pairCount: Number(data.pairCount) || 0,
      error: data.error,
    };
  }
  return syncExchangerFeed(exchangerId);
}
