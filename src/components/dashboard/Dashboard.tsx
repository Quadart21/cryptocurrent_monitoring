"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  DashboardCatalog,
  DashboardCityOption,
  DashboardCurrencyOption,
} from "@/lib/bestchange/dashboard-catalog-types";
import type { LiveOffer } from "@/components/RateTable";
import {
  RatesBoard,
  type RatesSortBy,
} from "@/components/dashboard/RatesBoard";
import {
  FastAction,
  type ExchangeMode,
} from "@/components/dashboard/FastAction";
import { DashboardAdSlot } from "@/components/ads/SiteAds";
import {
  defaultAmountFor,
  offerFitsAmount,
} from "@/lib/bestchange/catalog-client-amount";

type Props = {
  catalog: DashboardCatalog;
  initialFrom: string;
  initialTo: string;
  initialMode: ExchangeMode;
  initialCity: string;
  initialOffers: LiveOffer[];
};

export function Dashboard({
  catalog,
  initialFrom,
  initialTo,
  initialMode,
  initialCity,
  initialOffers,
}: Props) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<ExchangeMode>(initialMode);
  const [city, setCity] = useState(initialCity);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [offers, setOffers] = useState<LiveOffer[]>(initialOffers);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(() => defaultAmountFor(initialFrom));
  const [sortBy, setSortBy] = useState<RatesSortBy>("rate");
  const [recentReviews, setRecentReviews] = useState<
    Array<{
      id: string;
      exchangerName: string;
      exchangerSlug: string;
      sentiment: string;
      text: string;
      createdAt: string;
    }>
  >([]);
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

  const bestRate = useMemo(() => {
    if (!offers.length) return undefined;
    if (!(amount > 0)) return offers[0]?.rate;
    const suitable = offers.filter((o) => offerFitsAmount(amount, o).ok);
    const pool = suitable.length ? suitable : offers;
    let top = pool[0]?.rate;
    for (const o of pool) {
      if (top == null || o.rate > top) top = o.rate;
    }
    return top;
  }, [offers, amount]);

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
    return {
      from: catalog.defaultOnlineFrom,
      to: catalog.defaultOnlineTo,
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
          cache: "no-store",
        });

        if (id !== requestId.current) return;

        if (ratesRes.ok) {
          const data = (await ratesRes.json()) as {
            offers: LiveOffer[];
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

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/reviews?status=approved&limit=3", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          reviews?: Array<{
            id: string;
            exchangerName: string;
            exchangerSlug: string;
            sentiment: string;
            text: string;
            createdAt: string;
          }>;
        };
        setRecentReviews((body.reviews ?? []).slice(0, 3));
      } catch {
        // ignore
      }
    })();
  }, []);

  function onModeChange(next: ExchangeMode) {
    if (next === mode) return;
    const defaults = defaultsForMode(next);
    setMode(next);
    setFrom(defaults.from);
    setTo(defaults.to);
    setCity(defaults.city);
    setAmount(defaultAmountFor(defaults.from));
    setOffers([]);
  }

  function onCityChange(code: string) {
    setCity(code);
    setOffers([]);
  }

  function onFromChange(code: string) {
    setFrom(code);
    setAmount(defaultAmountFor(code));
    setOffers([]);
  }

  function onToChange(code: string) {
    setTo(code);
    setOffers([]);
  }

  function onPairChange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setAmount(defaultAmountFor(nextFrom));
    setOffers([]);
  }

  function onSwap() {
    setFrom(to);
    setTo(from);
    setAmount(defaultAmountFor(to));
    setOffers([]);
  }

  return (
    <div className="space-y-5">
      <FastAction
        mode={mode}
        city={city}
        from={from}
        to={to}
        currencies={currencies}
        cities={cities}
        popularPairs={
          mode === "cash"
            ? catalog.popularCashPairs
            : catalog.popularOnlinePairs
        }
        bestRate={bestRate}
        offerCount={offers.length}
        amount={amount}
        onAmountChange={setAmount}
        onModeChange={onModeChange}
        onCityChange={onCityChange}
        onFromChange={onFromChange}
        onToChange={onToChange}
        onPairChange={onPairChange}
        onSwap={onSwap}
      />

      <div id="rates-board" className="animate-rise-delay-1 space-y-4">
        <DashboardAdSlot />
        <RatesBoard
          offers={offers}
          from={from}
          to={to}
          currencies={currencies}
          loading={loading}
          cityLabel={mode === "cash" ? cityDisplayName : undefined}
          amount={amount}
          onAmountChange={setAmount}
          sortBy={sortBy}
          onSortChange={setSortBy}
          recentReviews={recentReviews}
          showAmountControl={false}
        />
      </div>
    </div>
  );
}
