import "server-only";

import {
  countPendingCatalogProposals,
  discoverCatalogProposals,
} from "@/lib/bestchange/catalog-proposals";
import { getCatalogSnapshot } from "@/lib/bestchange/catalog-store";

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapCatalogPollerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapCatalogSyncInFlight: Promise<unknown> | null | undefined;
}

/** Default: every 12 hours. Override with CATALOG_SYNC_INTERVAL_MS. */
const DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000;
const START_DELAY_MS = 25_000;

function intervalMs(): number {
  const raw = Number(process.env.CATALOG_SYNC_INTERVAL_MS ?? "");
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return DEFAULT_INTERVAL_MS;
}

/**
 * Discover new currencies/cities/countries and queue for moderation.
 * Live catalog is unchanged until admin approves.
 */
export async function runCatalogDiscovery(): Promise<{
  fetchedAt: string;
  newCurrencies: number;
  newCities: number;
  newCountries: number;
  pendingTotal: number;
  remoteCounts: ReturnType<typeof getCatalogSnapshot>["counts"];
}> {
  if (globalThis.__gapsnapCatalogSyncInFlight) {
    await globalThis.__gapsnapCatalogSyncInFlight;
    return {
      fetchedAt: getCatalogSnapshot().fetchedAt,
      newCurrencies: 0,
      newCities: 0,
      newCountries: 0,
      pendingTotal: await countPendingCatalogProposals(),
      remoteCounts: getCatalogSnapshot().counts,
    };
  }

  const run = (async () => {
    const result = await discoverCatalogProposals();
    const added =
      result.newCurrencies + result.newCities + result.newCountries;
    if (added > 0) {
      console.info(
        `[gapsnap] catalog discovery: +${result.newCurrencies} currencies, +${result.newCities} cities, +${result.newCountries} countries (pending ${result.pendingTotal})`,
      );
    } else {
      console.info(
        `[gapsnap] catalog discovery: no new codes (pending ${result.pendingTotal})`,
      );
    }
    return result;
  })().finally(() => {
    globalThis.__gapsnapCatalogSyncInFlight = null;
  });

  globalThis.__gapsnapCatalogSyncInFlight = run;
  return run;
}

export function startCatalogPoller(): void {
  if (globalThis.__gapsnapCatalogPollerStarted) return;
  globalThis.__gapsnapCatalogPollerStarted = true;

  const ms = intervalMs();
  const tick = () => {
    void runCatalogDiscovery().catch((error) => {
      console.error("[gapsnap] catalog discovery failed", error);
    });
  };

  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, ms);

  console.info(
    `[gapsnap] catalog discovery poller started (every ${Math.round(ms / 3_600_000)}h)`,
  );
}
