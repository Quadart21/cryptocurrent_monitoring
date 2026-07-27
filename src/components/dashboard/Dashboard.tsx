"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { POPULAR_FEED_PAIRS } from "@/lib/bestchange/popular-pairs";
import type {
  DashboardCatalog,
  DashboardCityOption,
  DashboardCurrencyOption,
} from "@/lib/bestchange/dashboard-catalog-types";
import type { LiveOffer } from "@/components/RateTable";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { StatsChart } from "@/components/dashboard/StatsChart";
import { RatesBoard } from "@/components/dashboard/RatesBoard";
import {
  FastAction,
  type ExchangeMode,
} from "@/components/dashboard/FastAction";
import { DashboardAdSlot } from "@/components/ads/SiteAds";

type Props = {
  catalog: DashboardCatalog;
  initialFrom: string;
  initialTo: string;
  initialMode: ExchangeMode;
  initialCity: string;
  initialOffers: LiveOffer[];
  initialLastSyncAt: string | null;
  initialPairCount: number;
  initialExchangerCount: number;
};

export function Dashboard({
  catalog,
  initialFrom,
  initialTo,
  initialMode,
  initialCity,
  initialOffers,
  initialLastSyncAt,
  initialPairCount,
  initialExchangerCount,
}: Props) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<ExchangeMode>(initialMode);
  const [city, setCity] = useState(initialCity);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [offers, setOffers] = useState<LiveOffer[]>(initialOffers);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(initialLastSyncAt);
  const [exchangerCount] = useState(initialExchangerCount);
  const [pairCount, setPairCount] = useState(initialPairCount);
  const [loading, setLoading] = useState(false);
  const bootstrapped = useRef(true);
  const requestId = useRef(0);
  const skipFirstPoll = useRef(true);
  const urlKey = searchParams.toString();

  const currencies: DashboardCurrencyOption[] = useMemo(
    () =>
      mode === "cash" ? catalog.cashModeCurrencies : catalog.onlineCurrencies,
    [mode, catalog],
  );

  const cities: DashboardCityOption[] = catalog.cities;

  const cityDisplayName = useMemo(() => {
    if (!city) return undefined;
    return cities.find((c) => c.code === city)?.name ?? city;
  }, [city, cities]);

  function defaultsForMode(next: ExchangeMode): {
    from: string;
    to: string;
    city: string;
  } {
    if (next === "cash") {
      return {
        from: catalog.defaultCashFrom,
        to: catalog.defaultCashTo,
        city: catalog.defaultCity,
      };
    }
    const codes = new Set(catalog.onlineCurrencies.map((c) => c.code));
    const preferred = POPULAR_FEED_PAIRS.find(
      ([a, b]) => codes.has(a) && codes.has(b),
    );
    return {
      from: preferred?.[0] ?? catalog.defaultOnlineFrom,
      to: preferred?.[1] ?? catalog.defaultOnlineTo,
      city: "",
    };
  }

  const loadRates = useCallback(
    async (
      nextFrom: string,
      nextTo: string,
      nextMode: ExchangeMode,
      nextCity: string,
      opts?: { scroll?: boolean },
    ) => {
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

        const ratesRes = await fetch(`/api/rates?${params}`, {
          next: { revalidate: 60 },
        });

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

          if (opts?.scroll && bootstrapped.current) {
            requestAnimationFrame(() => {
              document
                .getElementById("rates-board")
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
          }
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const spFrom = searchParams.get("from")?.trim().toUpperCase();
    const spTo = searchParams.get("to")?.trim().toUpperCase();
    const spMode = searchParams.get("mode") === "cash" ? "cash" : "online";
    const spCity =
      spMode === "cash"
        ? searchParams.get("city")?.trim().toUpperCase() ||
          catalog.defaultCity
        : "";

    if (!spFrom && !spTo && !searchParams.get("mode")) return;

    const nextFrom = spFrom || from;
    const nextTo = spTo || to;
    if (
      nextFrom === from &&
      nextTo === to &&
      spMode === mode &&
      spCity === city
    ) {
      return;
    }

    skipFirstPoll.current = false;
    setMode(spMode);
    setFrom(nextFrom);
    setTo(nextTo);
    setCity(spCity);
    setOffers([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey, catalog.defaultCity]);

  useEffect(() => {
    if (skipFirstPoll.current) {
      skipFirstPoll.current = false;
      return;
    }
    void loadRates(from, to, mode, city, { scroll: true });
  }, [from, to, mode, city, loadRates]);

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadRates(from, to, mode, city);
    };
    const id = setInterval(tick, 60_000);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [from, to, mode, city, loadRates]);

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
          cities={cities}
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
          cityLabel={mode === "cash" ? cityDisplayName : undefined}
        />
      </div>
    </div>
  );
}
