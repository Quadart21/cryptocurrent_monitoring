import "server-only";

import type { DashboardCatalog } from "@/lib/bestchange/dashboard-catalog-types";
import {
  POPULAR_FEED_PAIRS,
  cityLabel,
  listCashCurrencies,
  listCities,
  listOnlineCurrencies,
} from "@/lib/bestchange/catalog";

export type {
  DashboardCatalog,
  DashboardCityOption,
  DashboardCurrencyOption,
} from "@/lib/bestchange/dashboard-catalog-types";

export function getDashboardCatalog(): DashboardCatalog {
  const onlineCurrencies = listOnlineCurrencies().map((c) => ({
    code: c.code,
    name: c.name,
  }));
  const cashCurrencies = listCashCurrencies().map((c) => ({
    code: c.code,
    name: c.name,
  }));
  const cashModeCurrencies = [...cashCurrencies, ...onlineCurrencies];

  const cities = [...listCities()]
    .map((c) => ({
      code: c.code,
      name: cityLabel(c.code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));

  const defaultCity =
    cities.find((c) => c.code === "MSK")?.code ?? cities[0]?.code ?? "MSK";

  const onlineCodes = new Set(onlineCurrencies.map((c) => c.code));
  const preferred = POPULAR_FEED_PAIRS.find(
    ([a, b]) => onlineCodes.has(a) && onlineCodes.has(b),
  );

  return {
    onlineCurrencies,
    cashModeCurrencies,
    cities,
    defaultCity,
    defaultOnlineFrom: preferred?.[0] ?? "USDTTRC20",
    defaultOnlineTo: preferred?.[1] ?? "SBERRUB",
    defaultCashFrom: "USDTTRC20",
    defaultCashTo: "CASHRUB",
  };
}
