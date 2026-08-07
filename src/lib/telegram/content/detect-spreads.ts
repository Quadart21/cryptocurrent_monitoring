import "server-only";

import { ensureCatalogsHydrated } from "@/lib/bestchange/catalog-store";
import { pairPath } from "@/lib/bestchange/pair-slug";
import { getActiveRates } from "@/lib/store";
import {
  parsePairFilter,
  pairAllowed,
} from "@/lib/telegram/content/pair-filter";
import type { SpreadPayload } from "@/lib/telegram/content/types";

export type SpreadCandidate = SpreadPayload & {
  dedupeKey: string;
  title: string;
};

function cooldownBucket(cooldownHours: number): string {
  const hours = Math.max(1, Math.floor(cooldownHours));
  const bucket = Math.floor(Date.now() / (hours * 3_600_000));
  return String(bucket);
}

/**
 * Find pairs with a large best/worst rate spread.
 * Uses one rates scan (no per-pair queryRates).
 */
export async function findSpreadCandidates(input: {
  minSpreadPct: number;
  minOffers: number;
  maxResults: number;
  cooldownHours: number;
  includeCash?: boolean;
  allowlist?: string;
  blocklist?: string;
}): Promise<SpreadCandidate[]> {
  await ensureCatalogsHydrated();
  const rates = await getActiveRates();
  const allow = parsePairFilter(input.allowlist ?? "");
  const block = parsePairFilter(input.blocklist ?? "");
  const includeCash = Boolean(input.includeCash);
  const groups = new Map<
    string,
    { from: string; to: string; values: number[] }
  >();

  for (const r of rates) {
    if (!includeCash && r.city && r.city.trim()) continue;
    const from = r.from.trim().toUpperCase();
    const to = r.to.trim().toUpperCase();
    if (!from || !to) continue;
    if (!includeCash && (from.startsWith("CASH") || to.startsWith("CASH"))) {
      continue;
    }
    if (!pairAllowed(from, to, allow, block)) continue;
    if (!Number.isFinite(r.rate) || r.rate <= 0) continue;
    const key = `${from}:${to}`;
    const cur = groups.get(key);
    if (cur) cur.values.push(r.rate);
    else groups.set(key, { from, to, values: [r.rate] });
  }

  const minSpread = Math.max(0.1, input.minSpreadPct);
  const minOffers = Math.max(2, Math.floor(input.minOffers));
  const bucket = cooldownBucket(input.cooldownHours);
  const out: SpreadCandidate[] = [];

  for (const g of groups.values()) {
    if (g.values.length < minOffers) continue;
    const bestRate = Math.max(...g.values);
    const worstRate = Math.min(...g.values);
    if (!(bestRate > worstRate) || worstRate <= 0) continue;
    const spreadPct = ((bestRate - worstRate) / worstRate) * 100;
    if (!Number.isFinite(spreadPct) || spreadPct < minSpread) continue;
    const path = pairPath(g.from, g.to);
    out.push({
      from: g.from,
      to: g.to,
      bestRate,
      worstRate,
      offerCount: g.values.length,
      spreadPct,
      pairPath: path,
      dedupeKey: `spread:${g.from}:${g.to}:${bucket}`,
      title: `${g.from} → ${g.to} · ${spreadPct.toFixed(2)}%`,
    });
  }

  out.sort((a, b) => {
    if (b.spreadPct !== a.spreadPct) return b.spreadPct - a.spreadPct;
    return b.offerCount - a.offerCount;
  });

  return out.slice(0, Math.max(1, Math.floor(input.maxResults)));
}
