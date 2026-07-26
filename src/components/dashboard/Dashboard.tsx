"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { POPULAR_FEED_PAIRS, listCurrencies } from "@/lib/bestchange/catalog";
import type { LiveOffer } from "@/components/RateTable";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { StatsChart } from "@/components/dashboard/StatsChart";
import { RatesBoard } from "@/components/dashboard/RatesBoard";
import { FastAction } from "@/components/dashboard/FastAction";

type CurrencyOption = { code: string; name: string };

const ALL_CURRENCIES: CurrencyOption[] = listCurrencies().map((c) => ({
  code: c.code,
  name: c.name,
}));

export function Dashboard() {
  const [from, setFrom] = useState("USDTTRC20");
  const [to, setTo] = useState("SBERRUB");
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [exchangerCount, setExchangerCount] = useState(0);
  const [pairCount, setPairCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);
  const requestId = useRef(0);

  const load = useCallback(async (nextFrom: string, nextTo: string) => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const [ratesRes, exRes] = await Promise.all([
        fetch(
          `/api/rates?from=${encodeURIComponent(nextFrom)}&to=${encodeURIComponent(nextTo)}`,
          { cache: "no-store" },
        ),
        fetch("/api/exchangers", { cache: "no-store" }),
      ]);

      if (id !== requestId.current) return;

      if (ratesRes.ok) {
        const data = (await ratesRes.json()) as {
          offers: LiveOffer[];
          lastGlobalSyncAt: string | null;
          activePairCount?: number;
        };
        setOffers(data.offers);
        setLastSyncAt(data.lastGlobalSyncAt);
        setPairCount(data.activePairCount ?? 0);

        if (bootstrapped.current) {
          requestAnimationFrame(() => {
            document
              .getElementById("rates-board")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          });
        }

        if (!bootstrapped.current) {
          const codes = new Set(ALL_CURRENCIES.map((c) => c.code));
          if (!codes.has(nextFrom) || !codes.has(nextTo)) {
            const preferred = POPULAR_FEED_PAIRS.find(
              ([a, b]) => codes.has(a) && codes.has(b),
            );
            if (preferred) {
              bootstrapped.current = true;
              setFrom(preferred[0]);
              setTo(preferred[1]);
              return;
            }
          }
          bootstrapped.current = true;
        }
      }

      if (exRes.ok) {
        const data = (await exRes.json()) as { exchangers: unknown[] };
        setExchangerCount(data.exchangers.length);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(from, to);
    const id = setInterval(() => void load(from, to), 60_000);
    return () => clearInterval(id);
  }, [from, to, load]);

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
          from={from}
          to={to}
          currencies={ALL_CURRENCIES}
          bestRate={offers[0]?.rate}
          offerCount={offers.length}
          onFromChange={onFromChange}
          onToChange={onToChange}
          onPairChange={onPairChange}
          onSwap={onSwap}
        />
      </div>

      <div id="rates-board">
        <RatesBoard offers={offers} from={from} to={to} loading={loading} />
      </div>
    </div>
  );
}
