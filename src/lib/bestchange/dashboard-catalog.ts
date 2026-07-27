import "server-only";

import type { DashboardCatalog } from "@/lib/bestchange/dashboard-catalog-types";
import {
  POPULAR_CASH_PAIRS,
  POPULAR_FEED_PAIRS,
  cityLabel,
  listCashCurrencies,
  listCities,
  listOnlineCurrencies,
} from "@/lib/bestchange/catalog";
import { mergePopularPairs } from "@/lib/bestchange/popular-pairs";
import { getTopDemandPairs } from "@/lib/store";

export type {
  DashboardCatalog,
  DashboardCityOption,
  DashboardCurrencyOption,
} from "@/lib/bestchange/dashboard-catalog-types";

export async function getDashboardCatalog(): Promise<DashboardCatalog> {
  const onlineRaw = listOnlineCurrencies();
  const onlineCurrencies = onlineRaw.map((c) => ({
    code: c.code,
    name: c.name,
  }));
  const cashCurrencies = listCashCurrencies().map((c) => ({
    code: c.code,
    name: c.name,
  }));
  // В «Наличных»: наличный фиат + крипта/прочее, без банков.
  const BANK_GROUP_IDS = new Set([2, 3]);
  const cashModeCurrencies = [
    ...cashCurrencies,
    ...onlineRaw
      .filter((c) => !BANK_GROUP_IDS.has(c.groupId))
      .map((c) => ({ code: c.code, name: c.name })),
  ];

  const cities = [...listCities()]
    .map((c) => ({
      code: c.code,
      name: cityLabel(c.code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));

  const defaultCity =
    cities.find((c) => c.code === "MSK")?.code ?? cities[0]?.code ?? "MSK";

  const [liveOnline, liveCash] = await Promise.all([
    getTopDemandPairs({ mode: "online", limit: 8 }),
    getTopDemandPairs({ mode: "cash", limit: 8 }),
  ]);

  const popularOnlinePairs = mergePopularPairs(
    liveOnline,
    POPULAR_FEED_PAIRS,
    4,
  );
  const popularCashPairs = mergePopularPairs(
    liveCash,
    POPULAR_CASH_PAIRS,
    4,
  );

  const onlineCodes = new Set(onlineCurrencies.map((c) => c.code));
  const preferred =
    popularOnlinePairs.find(
      ([a, b]) => onlineCodes.has(a) && onlineCodes.has(b),
    ) ??
    POPULAR_FEED_PAIRS.find(
      ([a, b]) => onlineCodes.has(a) && onlineCodes.has(b),
    );

  const cashCodes = new Set(cashModeCurrencies.map((c) => c.code));
  const preferredCash =
    popularCashPairs.find(
      ([a, b]) => cashCodes.has(a) && cashCodes.has(b),
    ) ?? POPULAR_CASH_PAIRS[0];

  return {
    onlineCurrencies,
    cashModeCurrencies,
    cities,
    defaultCity,
    defaultOnlineFrom: preferred?.[0] ?? "USDTTRC20",
    defaultOnlineTo: preferred?.[1] ?? "SBPRUB",
    defaultCashFrom: preferredCash?.[0] ?? "USDTTRC20",
    defaultCashTo: preferredCash?.[1] ?? "CASHRUB",
    popularOnlinePairs,
    popularCashPairs,
  };
}
