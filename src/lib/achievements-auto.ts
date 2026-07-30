import "server-only";

import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { rates } from "@/db/schema";
import {
  evaluateAchievementRule,
  sameIdList,
  type AchievementSignals,
} from "@/lib/achievement-rules";
import {
  isExchangerBlacklisted,
  listAchievements,
  listBlacklist,
  listExchangers,
  replaceExchangerAchievementIds,
  type ExchangerAchievement,
  type FeedExchanger,
} from "@/lib/store";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const START_DELAY_MS = 120_000;

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapAchievementPollerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapAchievementRecomputeInFlight:
    | Promise<AchievementRecomputeResult>
    | null
    | undefined;
}

export type AchievementRecomputeResult = {
  checked: number;
  updated: number;
  autoRules: number;
  matchCounts: Record<string, number>;
  checkedAt: string;
};

function intervalMs(): number {
  const raw = Number(process.env.ACHIEVEMENT_SYNC_INTERVAL_MS ?? "");
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return DEFAULT_INTERVAL_MS;
}

async function reserveSumsByExchanger(
  exchangerIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!exchangerIds.length) return map;
  const db = getDb();
  const rows = await db
    .select({
      exchangerId: rates.exchangerId,
      total: sql<number>`coalesce(sum(${rates.reserve}), 0)`,
    })
    .from(rates)
    .where(inArray(rates.exchangerId, exchangerIds))
    .groupBy(rates.exchangerId);
  for (const row of rows) {
    map.set(row.exchangerId, Number(row.total) || 0);
  }
  return map;
}

function signalsFor(
  ex: FeedExchanger,
  blacklisted: boolean,
  reserveSum: number,
): AchievementSignals {
  return {
    verified: ex.verified,
    rating: ex.rating,
    reviews: ex.reviews,
    reviewsPositive: ex.reviewsPositive,
    reviewsNegative: ex.reviewsNegative,
    ageYears: ex.ageYears,
    pairCount: ex.pairCount,
    approvedAt: ex.approvedAt,
    lastSyncAt: ex.lastSyncAt,
    blacklisted,
    reserveSum,
  };
}

function autoAchievements(
  all: ExchangerAchievement[],
): Array<ExchangerAchievement & { rule: NonNullable<ExchangerAchievement["rule"]> }> {
  return all.filter(
    (
      a,
    ): a is ExchangerAchievement & {
      rule: NonNullable<ExchangerAchievement["rule"]>;
    } => a.mode === "auto" && a.rule != null,
  );
}

function mergeIds(
  current: string[],
  catalog: ExchangerAchievement[],
  earnedAuto: string[],
): string[] {
  const autoSet = new Set(
    catalog.filter((a) => a.mode === "auto").map((a) => a.id),
  );
  const manualKept = current.filter((id) => !autoSet.has(id));
  return [...new Set([...manualKept, ...earnedAuto])];
}

export async function recomputeExchangerAchievements(
  exchangerId: string,
): Promise<boolean> {
  const all = await listExchangers();
  const ex = all.find((e) => e.id === exchangerId);
  if (!ex || ex.status !== "active") return false;

  const catalog = await listAchievements();
  const autos = autoAchievements(catalog);
  if (!autos.length) return false;

  const bl = await listBlacklist();
  const reserves = await reserveSumsByExchanger([ex.id]);
  const s = signalsFor(
    ex,
    isExchangerBlacklisted(ex, bl),
    reserves.get(ex.id) ?? 0,
  );

  const earned = autos
    .filter((a) => evaluateAchievementRule(a.rule, s))
    .map((a) => a.id);
  const next = mergeIds(ex.achievementIds ?? [], catalog, earned);
  if (sameIdList(ex.achievementIds ?? [], next)) return false;
  await replaceExchangerAchievementIds(ex.id, next);
  return true;
}

export async function recomputeAllAchievements(options?: {
  dryRun?: boolean;
}): Promise<AchievementRecomputeResult> {
  if (globalThis.__gapsnapAchievementRecomputeInFlight && !options?.dryRun) {
    return globalThis.__gapsnapAchievementRecomputeInFlight;
  }

  const run = (async (): Promise<AchievementRecomputeResult> => {
    const catalog = await listAchievements();
    const autos = autoAchievements(catalog);
    const matchCounts: Record<string, number> = {};
    for (const a of autos) matchCounts[a.id] = 0;

    if (!autos.length) {
      return {
        checked: 0,
        updated: 0,
        autoRules: 0,
        matchCounts,
        checkedAt: new Date().toISOString(),
      };
    }

    const all = await listExchangers();
    const targets = all.filter((e) => e.status === "active");
    const bl = await listBlacklist();
    const reserves = await reserveSumsByExchanger(targets.map((e) => e.id));

    let updated = 0;
    for (const ex of targets) {
      const s = signalsFor(
        ex,
        isExchangerBlacklisted(ex, bl),
        reserves.get(ex.id) ?? 0,
      );
      const earned = autos
        .filter((a) => evaluateAchievementRule(a.rule, s))
        .map((a) => a.id);
      for (const id of earned) matchCounts[id] = (matchCounts[id] ?? 0) + 1;

      const next = mergeIds(ex.achievementIds ?? [], catalog, earned);
      if (sameIdList(ex.achievementIds ?? [], next)) continue;
      if (!options?.dryRun) {
        await replaceExchangerAchievementIds(ex.id, next);
      }
      updated += 1;
    }

    return {
      checked: targets.length,
      updated,
      autoRules: autos.length,
      matchCounts,
      checkedAt: new Date().toISOString(),
    };
  })();

  if (!options?.dryRun) {
    globalThis.__gapsnapAchievementRecomputeInFlight = run;
  }

  try {
    return await run;
  } finally {
    if (!options?.dryRun) {
      globalThis.__gapsnapAchievementRecomputeInFlight = null;
    }
  }
}

/** Preview how many active exchangers match a single rule (no writes). */
export async function countAchievementRuleMatches(
  rule: NonNullable<ExchangerAchievement["rule"]>,
): Promise<number> {
  const all = await listExchangers();
  const targets = all.filter((e) => e.status === "active");
  const bl = await listBlacklist();
  const reserves = await reserveSumsByExchanger(targets.map((e) => e.id));
  let n = 0;
  for (const ex of targets) {
    const s = signalsFor(
      ex,
      isExchangerBlacklisted(ex, bl),
      reserves.get(ex.id) ?? 0,
    );
    if (evaluateAchievementRule(rule, s)) n += 1;
  }
  return n;
}

export function startAchievementPoller(): void {
  if (globalThis.__gapsnapAchievementPollerStarted) return;
  globalThis.__gapsnapAchievementPollerStarted = true;
  const ms = intervalMs();
  const tick = () => {
    void recomputeAllAchievements().catch((error) => {
      console.error("[gapsnap] achievement recompute failed", error);
    });
  };
  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, ms);
  console.info(
    `[gapsnap] achievement poller started (every ${Math.round(ms / 3_600_000)}h)`,
  );
}
