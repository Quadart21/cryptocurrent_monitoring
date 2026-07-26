import {
  getStore,
  replaceExchangerRates,
  type FeedExchanger,
} from "@/lib/store";
import { parseRatesXml } from "@/lib/xml/parse-rates";

const FETCH_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 60_000;

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

async function syncOne(exchanger: FeedExchanger): Promise<void> {
  try {
    const xml = await fetchFeedXml(exchanger.feedUrl);
    const items = parseRatesXml(xml);
    await replaceExchangerRates(exchanger.id, items, { ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка синхронизации";
    await replaceExchangerRates(exchanger.id, [], { ok: false, error: message });
  }
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

  let ok = 0;
  let failed = 0;

  for (const exchanger of targets) {
    await syncOne(exchanger);
    const after = (await getStore()).exchangers.find((e) => e.id === exchanger.id);
    if (after?.status === "active" && !after.lastError) ok += 1;
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

  // Initial sync shortly after boot, then every minute
  setTimeout(tick, 1_500);
  setInterval(tick, POLL_INTERVAL_MS);

  console.info(
    `[cryptomon] feed poller started (every ${POLL_INTERVAL_MS / 1000}s)`,
  );
}
