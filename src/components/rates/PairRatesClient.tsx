"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveOffer } from "@/components/RateTable";
import {
  RatesBoard,
  type RatesSortBy,
} from "@/components/dashboard/RatesBoard";
import { defaultAmountFor } from "@/lib/bestchange/catalog-client-amount";

type ReviewCard = {
  id: string;
  exchangerName: string;
  exchangerSlug: string;
  sentiment: string;
  text: string;
  createdAt: string;
};

type Props = {
  from: string;
  to: string;
  initialOffers: LiveOffer[];
  initialLastSyncAt: string | null;
  recentReviews?: ReviewCard[];
};

export function PairRatesClient({
  from,
  to,
  initialOffers,
  initialLastSyncAt,
  recentReviews = [],
}: Props) {
  const [offers, setOffers] = useState(initialOffers);
  const [lastSyncAt, setLastSyncAt] = useState(initialLastSyncAt);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(() => defaultAmountFor(from));
  const [sortBy, setSortBy] = useState<RatesSortBy>("rate");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, mode: "online" });
      const res = await fetch(`/api/rates?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        offers: LiveOffer[];
        lastGlobalSyncAt: string | null;
      };
      setOffers(data.offers ?? []);
      setLastSyncAt(data.lastGlobalSyncAt);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <RatesBoard
      offers={offers}
      from={from}
      to={to}
      loading={loading}
      amount={amount}
      onAmountChange={setAmount}
      lastSyncAt={lastSyncAt}
      sortBy={sortBy}
      onSortChange={setSortBy}
      recentReviews={recentReviews}
    />
  );
}
