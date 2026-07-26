"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  POPULAR_FEED_PAIRS,
  cityLabel,
  listCashCurrencies,
  listCities,
  listOnlineCurrencies,
} from "@/lib/bestchange/catalog";
import type { LiveOffer } from "@/components/RateTable";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { StatsChart } from "@/components/dashboard/StatsChart";
import { RatesBoard } from "@/components/dashboard/RatesBoard";
import {
  FastAction,
  type ExchangeMode,
} from "@/components/dashboard/FastAction";
import { DashboardAdSlot } from "@/components/ads/SiteAds";

type CurrencyOption = { code: string; name: string };

const ONLINE_CURRENCIES: CurrencyOption[] = listOnlineCurrencies().map((c) => ({
  code: c.code,
  name: c.name,
}));

const CASH_CURRENCIES: CurrencyOption[] = listCashCurrencies().map((c) => ({
  code: c.code,
  name: c.name,
}));

/** Наличные: фиат cash + остальные направления (крипта/банки) для пар crypto↔cash */
const CASH_MODE_CURRENCIES: CurrencyOption[] = [
  ...CASH_CURRENCIES,
  ...ONLINE_CURRENCIES,
];

const CITY_OPTIONS = [...listCities()]
  .map((c) => ({
    code: c.code,
    name: cityLabel(c.code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));

/** Default city: Москва if present, otherwise first alphabetically */
const DEFAULT_CITY =
  CITY_OPTIONS.find((c) => c.code === "MSK")?.code ??
  CITY_OPTIONS[0]?.code ??
  "MSK";

function defaultsForMode(mode: ExchangeMode): {
  from: string;
  to: string;
  city: string;
} {
  if (mode === "cash") {
    return {
      from: "USDTTRC20",
      to: "CASHRUB",
      city: DEFAULT_CITY,
    };
  }

  const codes = new Set(ONLINE_CURRENCIES.map((c) => c.code));
  const preferred = POPULAR_FEED_PAIRS.find(
    ([a, b]) => codes.has(a) && codes.has(b),
  );
  return {
    from: preferred?.[0] ?? "USDTTRC20",
    to: preferred?.[1] ?? "SBERRUB",
    city: "",
  };
}

export function Dashboard() {
  const initial = defaultsForMode("online");
  const [mode, setMode] = useState<ExchangeMode>("online");
  const [city, setCity] = useState(initial.city);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [exchangerCount, setExchangerCount] = useState(0);
  const [pairCount, setPairCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);
  const requestId = useRef(0);

  const currencies = useMemo(
    () => (mode === "cash" ? CASH_MODE_CURRENCIES : ONLINE_CURRENCIES),
    [mode],
  );

  const load = useCallback(
    async (nextFrom: string, nextTo: string, nextMode: ExchangeMode, nextCity: string) => {
      const id = ++requestId.current;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          from: nextFrom,
          to: nextTo,
          mode: nextMode,
        });
        if (nextMode === "cash" && nextCity) {
          params.set("city", nextCity);
        }

        const [ratesRes, exRes] = await Promise.all([
          fetch(`/api/rates?${params}`, { cache: "no-store" }),
          fetch("/api/exchangers", { cache: "no-store" }),
        ]);

        if (id !== requestId.current) return;

        if (ratesRes.ok) {
          const data = (await ratesRes.json()) as {
            offers: LiveOffer[];
            lastGlobalSyncAt: string | null;
            activePairCount?: number;
          };
          const sorted = [...(data.offers ?? [])].sort((a, b) => {
            if (b.rate !== a.rate) return b.rate - a.rate;
            const ratingA = a.exchanger?.rating ?? 0;
            const ratingB = b.exchanger?.rating ?? 0;
            if (ratingB !== ratingA) return ratingB - ratingA;
            return (a.exchanger?.name ?? "").localeCompare(
              b.exchanger?.name ?? "",
              "ru",
            );
          });
          setOffers(
            sorted.map((offer, index) => ({ ...offer, rank: index + 1 })),
          );
          setLastSyncAt(data.lastGlobalSyncAt);
          setPairCount(data.activePairCount ?? 0);

          if (bootstrapped.current) {
            requestAnimationFrame(() => {
              document
                .getElementById("rates-board")
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
          }
          bootstrapped.current = true;
        }

        if (exRes.ok) {
          const data = (await exRes.json()) as { exchangers: unknown[] };
          setExchangerCount(data.exchangers.length);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(from, to, mode, city);
    const id = setInterval(() => void load(from, to, mode, city), 60_000);
    return () => clearInterval(id);
  }, [from, to, mode, city, load]);

  function onModeChange(next: ExchangeMode) {
    if (next === mode) return;
    const defaults = defaultsForMode(next);
    setMode(next);
    setFrom(defaults.from);
    setTo(defaults.to);
    setCity(defaults.city);
    setOffers([]);
  }

  function onCityChange(code: string) {
    setCity(code);
    setOffers([]);
  }

  function onFromChange(code: string) {
    setFrom(code);
    setOffers([]);
  }

  function onToChange(code: string) {
    setTo(code);
    setOffers([]);
  }

  function onPairChange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setOffers([]);
  }

  function onSwap() {
    setFrom(to);
    setTo(from);
    setOffers([]);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5 lg:grid-cols-2">
          <OverviewCards
            exchangers={exchangerCount}
            pairs={pairCount}
            lastSyncAt={lastSyncAt}
          />
          <StatsChart />
        </div>

        <FastAction
          mode={mode}
          city={city}
          from={from}
          to={to}
          currencies={currencies}
          cities={CITY_OPTIONS}
          bestRate={offers[0]?.rate}
          offerCount={offers.length}
          onModeChange={onModeChange}
          onCityChange={onCityChange}
          onFromChange={onFromChange}
          onToChange={onToChange}
          onPairChange={onPairChange}
          onSwap={onSwap}
        />
      </div>

      <div id="rates-board" className="space-y-4">
        <DashboardAdSlot />
        <RatesBoard
          offers={offers}
          from={from}
          to={to}
          loading={loading}
          city={mode === "cash" ? city : undefined}
        />
      </div>
    </div>
  );
}
