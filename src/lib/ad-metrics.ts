import {
  emptyAdStats,
  normalizeAdStats,
  utcDayKey,
} from "@/lib/ads";
import { applyAdStatDeltas, type AdStatDelta } from "@/lib/store";

type Pending = { impressions: number; clicks: number };

const pending = new Map<string, Pending>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

const FLUSH_MS = 1500;
const DAILY_KEEP = 30;

export function queueAdEvent(
  id: string,
  event: "impression" | "click",
  count = 1,
) {
  if (!id || count < 1) return;
  const row = pending.get(id) ?? { impressions: 0, clicks: 0 };
  if (event === "impression") row.impressions += count;
  else row.clicks += count;
  pending.set(id, row);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAdMetrics();
  }, FLUSH_MS);
}

export async function flushAdMetrics(): Promise<void> {
  if (flushing) {
    await flushing;
    return;
  }
  if (!pending.size) return;

  const batch = new Map(pending);
  pending.clear();

  flushing = (async () => {
    const deltas: AdStatDelta[] = [...batch.entries()].map(([id, counts]) => ({
      id,
      impressions: counts.impressions,
      clicks: counts.clicks,
    }));
    await applyAdStatDeltas(deltas, DAILY_KEEP);
  })().finally(() => {
    flushing = null;
  });

  await flushing;
}

export { emptyAdStats, normalizeAdStats, utcDayKey };
