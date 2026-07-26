import { applyExchangerTrafficDeltas, type ExchangerTrafficDelta } from "@/lib/store";

type Pending = { pageViews: number; siteClicks: number };

const pending = new Map<string, Pending>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

const FLUSH_MS = 1500;
const DAILY_KEEP = 30;

export function queueExchangerTrafficEvent(
  id: string,
  event: "view" | "click",
  count = 1,
) {
  if (!id || count < 1) return;
  const row = pending.get(id) ?? { pageViews: 0, siteClicks: 0 };
  if (event === "view") row.pageViews += count;
  else row.siteClicks += count;
  pending.set(id, row);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushExchangerTraffic();
  }, FLUSH_MS);
}

export async function flushExchangerTraffic(): Promise<void> {
  if (flushing) {
    await flushing;
    return;
  }
  if (!pending.size) return;

  const batch = new Map(pending);
  pending.clear();

  flushing = (async () => {
    const deltas: ExchangerTrafficDelta[] = [...batch.entries()].map(
      ([id, counts]) => ({
        id,
        pageViews: counts.pageViews,
        siteClicks: counts.siteClicks,
      }),
    );
    await applyExchangerTrafficDeltas(deltas, DAILY_KEEP);
  })().finally(() => {
    flushing = null;
  });

  await flushing;
}
