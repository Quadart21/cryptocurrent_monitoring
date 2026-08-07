import "server-only";

import { getTelegramSettings } from "@/lib/telegram/service";
import { runTelegramContentCycle } from "@/lib/telegram/content/engine";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const START_DELAY_MS = 180_000;
const MIN_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 180 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapTelegramContentPollerStarted: boolean | undefined;
}

function envIntervalMs(): number | null {
  const raw = Number(process.env.TELEGRAM_CONTENT_INTERVAL_MS ?? "");
  if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) {
    return Math.min(MAX_INTERVAL_MS, raw);
  }
  return null;
}

async function resolveIntervalMs(): Promise<number> {
  const fromEnv = envIntervalMs();
  if (fromEnv != null) return fromEnv;
  try {
    const settings = await getTelegramSettings();
    const mins = settings.contentIntervalMinutes || 15;
    return Math.min(
      MAX_INTERVAL_MS,
      Math.max(MIN_INTERVAL_MS, Math.floor(mins) * 60_000),
    );
  } catch {
    return DEFAULT_INTERVAL_MS;
  }
}

export function startTelegramContentPoller(): void {
  if (globalThis.__gapsnapTelegramContentPollerStarted) return;
  globalThis.__gapsnapTelegramContentPollerStarted = true;

  const tick = () => {
    void (async () => {
      try {
        const settings = await getTelegramSettings();
        if (settings.contentEnabled) {
          await runTelegramContentCycle();
        }
      } catch (error) {
        console.error("[gapsnap] telegram content cycle failed", error);
      } finally {
        const ms = await resolveIntervalMs();
        setTimeout(tick, ms);
      }
    })();
  };

  setTimeout(tick, START_DELAY_MS);
  console.info(
    `[gapsnap] telegram content poller started (dynamic interval, first tick in ${Math.round(START_DELAY_MS / 1000)}s)`,
  );
}
