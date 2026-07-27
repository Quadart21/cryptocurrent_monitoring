import {
  getStore,
  replaceExchangerRatesBatch,
  type FeedExchanger,
} from "@/lib/store";
import { parseRatesXml, type ParsedRateItem } from "@/lib/xml/parse-rates";

const FETCH_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 60_000;
const FETCH_CONCURRENCY = 4;

export async function fetchFeedXml(feedUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/xml, text/xml, */*",
        "User-Agent": "CryptomonMonitor/1.0 (+https://cryptomon.local)",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} при запросе фида`);
    }

    const text = await res.text();
    if (!text.includes("<") || !/<rates[\s>]/i.test(text)) {
      throw new Error("Ответ не похож на BestChange XML (<rates>)");
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
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

export async function syncAllFeeds(): Promise<{
  total: number;
  ok: number;
  failed: number;
  syncedAt: string;
}> {
  const store = await getStore();
  const targets = store.exchangers.filter(
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
}

declare global {
  // eslint-disable-next-line no-var
  var __cryptomonPollerStarted: boolean | undefined;
}

export function startFeedPoller(): void {
  if (globalThis.__cryptomonPollerStarted) return;
  globalThis.__cryptomonPollerStarted = true;

  const tick = () => {
    void syncAllFeeds().catch((error) => {
      console.error("[cryptomon] feed sync failed", error);
    });
  };

  setTimeout(tick, 1_500);
  setInterval(tick, POLL_INTERVAL_MS);

  console.info(
    `[cryptomon] feed poller started (every ${POLL_INTERVAL_MS / 1000}s)`,
  );
}
