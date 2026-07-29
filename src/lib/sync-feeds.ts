import {
  listExchangers,
  replaceExchangerRatesBatch,
  type FeedExchanger,
} from "@/lib/store";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";
import { parseRatesXml, type ParsedRateItem } from "@/lib/xml/parse-rates";

const FETCH_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 60_000;
const FETCH_CONCURRENCY = 4;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2_500_000;

async function fetchWithSsrfGuard(feedUrl: string): Promise<Response> {
  let current = await assertSafeOutboundUrl(feedUrl, { allowHttp: true });

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "application/xml, text/xml, */*",
          "User-Agent": "GapSnapMonitor/1.0 (+https://gapsnap.local)",
          "Cache-Control": "no-cache",
        },
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

      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Не удалось загрузить фид");
}

export async function fetchFeedXml(feedUrl: string): Promise<string> {
  await assertSafeOutboundUrl(feedUrl, { allowHttp: true });
  const res = await fetchWithSsrfGuard(feedUrl);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} при запросе фида`);
  }

  const lengthHeader = res.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    throw new Error("Фид слишком большой");
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BODY_BYTES) {
    throw new Error("Фид слишком большой");
  }

  const text = buf.toString("utf8");
  if (!text.includes("<") || !/<rates[\s>]/i.test(text)) {
    throw new Error("Ответ не похож на XML-фид курсов (нужен корневой тег rates)");
  }

  return text;
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
    void syncAllFeeds().catch((error) => {
      console.error("[gapsnap] feed sync failed", error);
    });
  };

  setTimeout(tick, 1_500);
  setInterval(tick, POLL_INTERVAL_MS);

  console.info(
    `[gapsnap] feed poller started (every ${POLL_INTERVAL_MS / 1000}s)`,
  );
}
