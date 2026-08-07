import "server-only";

import { getTelegramSettings } from "@/lib/telegram/service";
import { runTelegramContentCycle } from "@/lib/telegram/content/engine";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const START_DELAY_MS = 180_000;

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapTelegramContentPollerStarted: boolean | undefined;
}

function intervalMs(): number {
  const raw = Number(process.env.TELEGRAM_CONTENT_INTERVAL_MS ?? "");
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return DEFAULT_INTERVAL_MS;
}

export function startTelegramContentPoller(): void {
  if (globalThis.__gapsnapTelegramContentPollerStarted) return;
  globalThis.__gapsnapTelegramContentPollerStarted = true;
  const ms = intervalMs();

  const tick = () => {
    void (async () => {
      const settings = await getTelegramSettings();
      if (!settings.contentEnabled) return;
      await runTelegramContentCycle();
    })().catch((error) => {
      console.error("[gapsnap] telegram content cycle failed", error);
    });
  };

  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, ms);
  console.info(
    `[gapsnap] telegram content poller started (every ${Math.round(ms / 60_000)}m)`,
  );
}
