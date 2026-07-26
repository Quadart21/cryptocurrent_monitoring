import currencyByCode from "@/data/bestchange/currency-by-code.json";
import cityByCode from "@/data/bestchange/city-by-code.json";
import countryByCode from "@/data/bestchange/country-by-code.json";
import groups from "@/data/bestchange/groups.json";
import index from "@/data/bestchange/index.json";

export type BcCurrency = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  viewname: string;
  urlname?: string;
  crypto: boolean;
  cash: boolean;
  groupId: number;
  ps?: number;
  defamt?: number;
  bigamt?: number;
  rank: number;
};

export type BcCity = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  countryId?: number;
  countryCode: string;
  countryName: string;
  rank: number;
};

export type BcCountry = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  rank: number;
};

export type BcGroup = {
  id: number;
  name: string;
  nameEn: string;
};

const currencies = currencyByCode as Record<string, BcCurrency>;
const cities = cityByCode as Record<string, BcCity>;
const countries = countryByCode as Record<string, BcCountry>;

export function getCurrency(code: string): BcCurrency | undefined {
  return currencies[code.toUpperCase()];
}

export function getCity(code: string): BcCity | undefined {
  return cities[code.toUpperCase()];
}

export function getCountry(code: string): BcCountry | undefined {
  return countries[code.toUpperCase()];
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

export function currencyDecimals(code: string): number {
  const c = getCurrency(code);
  const upper = code.toUpperCase();
  if (c?.cash) return 0;
  if (upper === "BTC" || upper.startsWith("BTC")) return 6;
  if (upper === "ETH" || upper.startsWith("ETH")) return 5;
  if (
    upper.includes("RUB") ||
    upper.includes("UAH") ||
    upper.includes("KZT") ||
    upper.includes("BYN") ||
    upper.includes("USD") ||
    upper.includes("EUR")
  ) {
    return 2;
  }
  if (!c?.crypto) return 2;
  return 4;
}

export function defaultAmountFor(code: string): number {
  const c = getCurrency(code);
  if (c?.defamt && c.defamt > 0) {
    // BestChange stores defamt in "display units" that are often too large for crypto
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
  return Object.values(currencies)
    .filter((c) => {
      if (options?.cash === true) return c.cash;
      if (options?.cash === false) return !c.cash;
      return true;
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "ru"));
}

export function listCities(): BcCity[] {
  return Object.values(cities).sort((a, b) =>
    a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
  );
}

export function listCountries(): BcCountry[] {
  return Object.values(countries).sort(
    (a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "ru"),
  );
}

export function listGroups(): BcGroup[] {
  return groups as BcGroup[];
}

export function listOnlineCurrencies(): BcCurrency[] {
  return listCurrencies({ cash: false });
}

export function listCashCurrencies(): BcCurrency[] {
  return listCurrencies({ cash: true });
}

export function catalogMeta() {
  return {
    fetchedAt: index.fetchedAt as string,
    counts: index.counts as {
      groups: number;
      countries: number;
      cities: number;
      currencies: number;
      changers: number;
    },
  };
}

/** Popular XML pairs used on the home calculator. */
export const POPULAR_FEED_PAIRS: [string, string][] = [
  ["USDTTRC20", "SBERRUB"],
  ["USDTTRC20", "SBPRUB"],
  ["USDTTRC20", "TCSBRUB"],
  ["BTC", "SBERRUB"],
  ["ETH", "SBERRUB"],
  ["SBERRUB", "USDTTRC20"],
  ["BTC", "USDTTRC20"],
];

export const POPULAR_CASH_PAIRS: [string, string][] = [
  ["USDTTRC20", "CASHRUB"],
  ["BTC", "CASHRUB"],
  ["USDTTRC20", "CASHUSD"],
  ["ETH", "CASHUSD"],
  ["CASHRUB", "USDTTRC20"],
  ["CASHUSD", "CASHRUB"],
];
