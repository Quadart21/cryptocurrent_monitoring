/**
 * Fallback popular pair shortcuts for the home calculator.
 * Prefer live demand ranking from `getTopDemandPairs` when rates exist.
 * Order reflects typical RU client demand (СБП / T-Bank / Sber / buy crypto).
 */
export const POPULAR_FEED_PAIRS: [string, string][] = [
  ["USDTTRC20", "SBPRUB"],
  ["USDTTRC20", "TCSBRUB"],
  ["USDTTRC20", "SBERRUB"],
  ["SBPRUB", "USDTTRC20"],
  ["USDTTRC20", "ACRUB"],
  ["BTC", "SBPRUB"],
  ["BTC", "USDTTRC20"],
  ["ETH", "SBPRUB"],
];

export const POPULAR_CASH_PAIRS: [string, string][] = [
  ["USDTTRC20", "CASHRUB"],
  ["BTC", "CASHRUB"],
  ["USDTTRC20", "CASHUSD"],
  ["ETH", "CASHUSD"],
  ["CASHRUB", "USDTTRC20"],
  ["CASHUSD", "CASHRUB"],
];

/** Merge live demand pairs with static fallbacks, keep order, dedupe. */
export function mergePopularPairs(
  live: [string, string][],
  fallback: [string, string][],
  limit = 4,
): [string, string][] {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const pair of [...live, ...fallback]) {
    const key = `${pair[0]}:${pair[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
    if (out.length >= limit) break;
  }
  return out;
}
