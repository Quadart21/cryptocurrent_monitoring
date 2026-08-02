import { ProxyAgent, fetch as undiciFetch } from "undici";
import {
  nextProxyEndpoint,
  proxyAuthConfigured,
  type ProxyEndpoint,
} from "@/lib/ai/proxy-pool";
import {
  listExchangers,
  replaceExchangerRatesBatch,
  type FeedExchanger,
} from "@/lib/store";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";
import { parseRatesXml, type ParsedRateItem } from "@/lib/xml/parse-rates";

/** Large feeds (e.g. Waybit ~2MB / 8k pairs) need more headroom than a small XML. */
const FETCH_TIMEOUT_MS = 45_000;
/** Target freshness: each exchanger XML is re-fetched about once per minute. */
const POLL_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.FEED_SYNC_INTERVAL_MS) || 60_000,
);
const FETCH_CONCURRENCY = Math.max(
  1,
  Math.min(16, Number(process.env.FEED_SYNC_CONCURRENCY) || 6),
);
/** How often the scheduler looks for exchangers due for refresh. */
const SCHEDULER_TICK_MS = 5_000;
const START_DELAY_MS = 1_500;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 12_000_000;

/**
 * BestChange-style export URLs often include a partner placeholder `:code`.
 * Replace with GapSnap id when fetching (rates are the same; tracking differs).
 */
export function resolveFeedUrl(feedUrl: string): string {
  const code =
    process.env.FEED_PARTNER_CODE?.trim() ||
    process.env.NEXT_PUBLIC_SITE_NAME?.trim().toLowerCase().replace(/\s+/g, "") ||
    "gapsnap";
  return feedUrl
    .trim()
    .replace(/:code\b/gi, encodeURIComponent(code))
    .replace(/\{code\}/gi, encodeURIComponent(code))
    .replace(/%code%/gi, encodeURIComponent(code));
}

const FEED_FETCH_ATTEMPTS = Math.max(
  1,
  Math.min(5, Number(process.env.FEED_FETCH_ATTEMPTS) || 3),
);
const FEED_RETRY_DELAY_MS = Math.max(
  200,
  Math.min(10_000, Number(process.env.FEED_RETRY_DELAY_MS) || 1_200),
);
/** Rotate through the Codex/news residential pool when Cloudflare blocks DC IP. */
const FEED_PROXY_ATTEMPTS = Math.max(
  0,
  Math.min(40, Number(process.env.FEED_PROXY_ATTEMPTS) || 24),
);
const FEED_PROXY_MODE = (
  process.env.FEED_PROXY_MODE?.trim().toLowerCase() || "auto"
) as "auto" | "always" | "never";

const FEED_HEADERS: Record<string, string> = {
  Accept: "application/xml, text/xml, */*",
  "Accept-Language": "ru,en;q=0.8",
  "User-Agent": "GapSnapMonitor/1.0 (+https://gapsnap.org)",
  "Cache-Control": "no-cache",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikeRatesXml(text: string): boolean {
  return text.includes("<") && /<rates[\s>]/i.test(text);
}

function isCloudflareChallenge(text: string): boolean {
  return /just a moment|cf-browser-verification|attention required|cdn-cgi\/challenge|cloudflare/i.test(
    text,
  );
}

function timeoutError(): Error {
  return new Error(
    `Таймаут загрузки фида (${Math.round(FETCH_TIMEOUT_MS / 1000)} с). Крупные XML могут грузиться дольше — попробуйте ещё раз.`,
  );
}

function asAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /aborted/i.test(error.message))
  );
}

async function readFeedBody(res: {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<string> {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} при запросе фида`);
  }

  const lengthHeader = res.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    throw new Error("Фид слишком большой (лимит 12 МБ)");
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BODY_BYTES) {
    throw new Error("Фид слишком большой (лимит 12 МБ)");
  }
  if (buf.length === 0) {
    throw new Error("Пустой ответ фида (0 байт)");
  }

  const text = buf.toString("utf8");
  if (!looksLikeRatesXml(text)) {
    if (isCloudflareChallenge(text)) {
      throw new Error(`HTTP ${res.status || 403} при запросе фида`);
    }
    throw new Error(
      "Ответ не похож на XML-фид курсов (нужен корневой тег rates)",
    );
  }
  return text;
}

async function fetchDirect(feedUrl: string): Promise<string> {
  let current = await assertSafeOutboundUrl(feedUrl, { allowHttp: true });

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: FEED_HEADERS,
        cache: "no-store",
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) throw new Error("Редирект без Location");
        if (hop === MAX_REDIRECTS) {
          throw new Error("Слишком много редиректов фида");
        }
        const next = new URL(location, current);
        current = await assertSafeOutboundUrl(next.toString(), {
          allowHttp: true,
        });
        continue;
      }

      return await readFeedBody(res);
    } catch (error) {
      if (asAbortError(error)) throw timeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Не удалось загрузить фид");
}

async function fetchViaProxy(
  feedUrl: string,
  proxy: ProxyEndpoint,
): Promise<string> {
  await assertSafeOutboundUrl(feedUrl, { allowHttp: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const agent = new ProxyAgent(proxy.url);
  try {
    const res = await undiciFetch(feedUrl, {
      method: "GET",
      headers: FEED_HEADERS,
      signal: controller.signal,
      dispatcher: agent,
    });
    return await readFeedBody(res);
  } catch (error) {
    if (asAbortError(error)) throw timeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    await agent.close().catch(() => undefined);
  }
}

function shouldTryProxy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /HTTP 403/i.test(message) ||
    /HTTP 429/i.test(message) ||
    /HTTP 503/i.test(message) ||
    /не похож на XML/i.test(message) ||
    /таймаут/i.test(message) ||
    /fetch failed/i.test(message) ||
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR/i.test(message)
  );
}

async function fetchFeedXmlOnce(feedUrl: string): Promise<string> {
  const resolved = resolveFeedUrl(feedUrl);
  await assertSafeOutboundUrl(resolved, { allowHttp: true });

  let lastError: unknown;

  if (FEED_PROXY_MODE !== "always") {
    try {
      return await fetchDirect(resolved);
    } catch (error) {
      lastError = error;
      if (FEED_PROXY_MODE === "never" || !shouldTryProxy(error)) {
        throw error;
      }
    }
  }

  if (FEED_PROXY_ATTEMPTS <= 0 || !(await proxyAuthConfigured())) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Не удалось загрузить фид");
  }

  for (let i = 0; i < FEED_PROXY_ATTEMPTS; i += 1) {
    const proxy = await nextProxyEndpoint();
    if (!proxy) break;
    try {
      const xml = await fetchViaProxy(resolved, proxy);
      if (i > 0 || FEED_PROXY_MODE === "always" || lastError) {
        console.info(
          `[gapsnap] feed via proxy ${proxy.host} ok (${resolved.slice(0, 64)})`,
        );
      }
      return xml;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Не удалось загрузить фид");
}

function isRetryableFeedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /пустой ответ/i.test(message) ||
    /не похож на XML/i.test(message) ||
    /HTTP 5\d\d/i.test(message) ||
    /HTTP 429/i.test(message) ||
    /таймаут/i.test(message) ||
    /fetch failed/i.test(message) ||
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR/i.test(message)
  );
}

export async function fetchFeedXml(feedUrl: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FEED_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchFeedXmlOnce(feedUrl);
    } catch (error) {
      lastError = error;
      if (attempt >= FEED_FETCH_ATTEMPTS || !isRetryableFeedError(error)) {
        break;
      }
      await sleep(FEED_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Не удалось загрузить фид");
}

export async function validateFeedUrl(feedUrl: string) {
  const xml = await fetchFeedXml(feedUrl);
  const items = parseRatesXml(xml);
  return { items, pairCount: items.length };
}

type SyncResult = {
  exchangerId: string;
  items: ParsedRateItem[];
  meta: { ok: true } | { ok: false; error: string };
};

async function fetchOne(exchanger: FeedExchanger): Promise<SyncResult> {
  try {
    const xml = await fetchFeedXml(exchanger.feedUrl);
    const items = parseRatesXml(xml);
    return { exchangerId: exchanger.id, items, meta: { ok: true } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка синхронизации";
    return {
      exchangerId: exchanger.id,
      items: [],
      meta: { ok: false, error: message },
    };
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapPollerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapSyncInFlight: Promise<{
    total: number;
    ok: number;
    failed: number;
    syncedAt: string;
  }> | null | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapFeedInFlightIds: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapFeedSchedulerBusy: boolean | undefined;
}

function inFlightIds(): Set<string> {
  if (!globalThis.__gapsnapFeedInFlightIds) {
    globalThis.__gapsnapFeedInFlightIds = new Set();
  }
  return globalThis.__gapsnapFeedInFlightIds;
}

function lastSyncAgeMs(ex: FeedExchanger, now: number): number {
  if (!ex.lastSyncAt) return Number.POSITIVE_INFINITY;
  const ts = Date.parse(ex.lastSyncAt);
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return now - ts;
}

function isDue(ex: FeedExchanger, now: number): boolean {
  return lastSyncAgeMs(ex, now) >= POLL_INTERVAL_MS;
}

/**
 * Continuously refresh exchangers whose last XML sync is older than
 * POLL_INTERVAL_MS. Writes each result immediately so the board updates
 * without waiting for a full fleet pass.
 */
async function syncDueExchangers(): Promise<void> {
  if (globalThis.__gapsnapFeedSchedulerBusy) return;
  if (globalThis.__gapsnapSyncInFlight) return;
  globalThis.__gapsnapFeedSchedulerBusy = true;

  try {
    const flying = inFlightIds();
    const slots = FETCH_CONCURRENCY - flying.size;
    if (slots <= 0) return;

    const now = Date.now();
    const exchangers = await listExchangers();
    const due = exchangers
      .filter((e) => e.status === "active" || e.status === "error")
      .filter((e) => !flying.has(e.id) && isDue(e, now))
      .sort((a, b) => lastSyncAgeMs(b, now) - lastSyncAgeMs(a, now))
      .slice(0, slots);

    for (const ex of due) {
      flying.add(ex.id);
      void (async () => {
        try {
          const result = await fetchOne(ex);
          await replaceExchangerRatesBatch([result]);
          if (!result.meta.ok) {
            console.warn(
              `[gapsnap] feed sync failed for ${ex.slug}: ${result.meta.error}`,
            );
          }
        } catch (error) {
          console.error(`[gapsnap] feed sync crashed for ${ex.slug}`, error);
        } finally {
          flying.delete(ex.id);
        }
      })();
    }
  } finally {
    globalThis.__gapsnapFeedSchedulerBusy = false;
  }
}

export async function syncExchangerFeed(exchangerId: string): Promise<{
  ok: boolean;
  pairCount: number;
  error?: string;
}> {
  const exchangers = await listExchangers();
  const target = exchangers.find((e) => e.id === exchangerId);
  if (!target) {
    return { ok: false, pairCount: 0, error: "Обменник не найден" };
  }
  const result = await fetchOne(target);
  await replaceExchangerRatesBatch([result]);
  if (!result.meta.ok) {
    return {
      ok: false,
      pairCount: 0,
      error: result.meta.error,
    };
  }
  return { ok: true, pairCount: result.items.length };
}

export async function syncAllFeeds(): Promise<{
  total: number;
  ok: number;
  failed: number;
  syncedAt: string;
}> {
  if (globalThis.__gapsnapSyncInFlight) {
    return globalThis.__gapsnapSyncInFlight;
  }

  const run = (async () => {
    const exchangers = await listExchangers();
    const targets = exchangers.filter(
      (e) => e.status === "active" || e.status === "error",
    );
    const flying = inFlightIds();
    for (const t of targets) flying.add(t.id);

    try {
      const results = await mapPool(targets, FETCH_CONCURRENCY, fetchOne);
      await replaceExchangerRatesBatch(results);

      let ok = 0;
      let failed = 0;
      for (const r of results) {
        if (r.meta.ok) ok += 1;
        else failed += 1;
      }

      return {
        total: targets.length,
        ok,
        failed,
        syncedAt: new Date().toISOString(),
      };
    } finally {
      for (const t of targets) flying.delete(t.id);
    }
  })().finally(() => {
    globalThis.__gapsnapSyncInFlight = null;
  });

  globalThis.__gapsnapSyncInFlight = run;
  return run;
}

export function startFeedPoller(): void {
  if (globalThis.__gapsnapPollerStarted) return;
  globalThis.__gapsnapPollerStarted = true;

  const tick = () => {
    void syncDueExchangers().catch((error) => {
      console.error("[gapsnap] feed scheduler failed", error);
    });
  };

  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, SCHEDULER_TICK_MS);

  console.info(
    `[gapsnap] feed poller started (per-exchanger every ${POLL_INTERVAL_MS / 1000}s, concurrency ${FETCH_CONCURRENCY}, tick ${SCHEDULER_TICK_MS / 1000}s)`,
  );
}
