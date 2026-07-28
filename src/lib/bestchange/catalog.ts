import "server-only";

import {
  ensureCatalogsHydrated,
  getCatalogSnapshot,
} from "@/lib/bestchange/catalog-store";
import type {
  BcCity,
  BcCountry,
  BcCurrency,
  BcGroup,
} from "@/lib/bestchange/catalog-types";

export type { BcCity, BcCountry, BcCurrency, BcGroup };
export { currencyDecimals } from "@/lib/bestchange/currency-decimals";
export {
  POPULAR_CASH_PAIRS,
  POPULAR_FEED_PAIRS,
} from "@/lib/bestchange/popular-pairs";

void ensureCatalogsHydrated();

function currenciesMap(): Record<string, BcCurrency> {
  return getCatalogSnapshot().currencies;
}

function citiesMap(): Record<string, BcCity> {
  return getCatalogSnapshot().cities;
}

function countriesMap(): Record<string, BcCountry> {
  return getCatalogSnapshot().countries;
}

export function getCurrency(code: string): BcCurrency | undefined {
  return currenciesMap()[code.toUpperCase()];
}

export function getCity(code: string): BcCity | undefined {
  return citiesMap()[code.toUpperCase()];
}

export function getCountry(code: string): BcCountry | undefined {
  return countriesMap()[code.toUpperCase()];
}

export function currencyLabel(code: string): string {
  const c = getCurrency(code);
  if (!c) return code;
  return c.name || c.viewname || c.code;
}

export function cityLabel(code: string): string {
  const c = getCity(code);
  if (!c) return code;
  return c.countryName ? `${c.name} (${c.countryName})` : c.name;
}

export function defaultAmountFor(code: string): number {
  const c = getCurrency(code);
  if (c?.defamt && c.defamt > 0) {
    if (c.crypto && c.defamt >= 1000) {
      if (code.toUpperCase().includes("BTC")) return 0.1;
      if (code.toUpperCase().includes("ETH")) return 1;
      return 100;
    }
    return c.defamt;
  }
  const upper = code.toUpperCase();
  if (upper.includes("BTC")) return 0.1;
  if (upper.includes("ETH")) return 1;
  if (c?.cash || upper.includes("RUB")) return 50_000;
  if (upper.startsWith("USDT") || upper.startsWith("USDC")) return 1000;
  return 1;
}

export function listCurrencies(options?: { cash?: boolean }): BcCurrency[] {
  return Object.values(currenciesMap())
    .filter((c) => {
      if (options?.cash === true) return c.cash;
      if (options?.cash === false) return !c.cash;
      return true;
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "ru"));
}

export function listCities(): BcCity[] {
  return Object.values(citiesMap()).sort((a, b) =>
    a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
  );
}

export function listCountries(): BcCountry[] {
  return Object.values(countriesMap()).sort(
    (a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "ru"),
  );
}

export function listGroups(): BcGroup[] {
  return getCatalogSnapshot().groups;
}

export function listOnlineCurrencies(): BcCurrency[] {
  return listCurrencies({ cash: false });
}

export function listCashCurrencies(): BcCurrency[] {
  return listCurrencies({ cash: true });
}

export function catalogMeta() {
  const snap = getCatalogSnapshot();
  return {
    fetchedAt: snap.fetchedAt,
    counts: snap.counts,
    source: snap.source,
  };
}
