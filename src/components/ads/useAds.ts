"use client";

import { useContext, useEffect, useState } from "react";
import { AdsContext, type PublicAd } from "@/components/ads/ads-context";
import type { AdPlacement } from "@/lib/store-types";

export type { PublicAd } from "@/components/ads/ads-context";

export function useAds(placement?: AdPlacement) {
  const ctx = useContext(AdsContext);
  const [fallback, setFallback] = useState<PublicAd[]>([]);

  useEffect(() => {
    if (ctx) return;
    const params = placement ? `?placement=${placement}` : "";
    void fetch(`/api/ads${params}`, { next: { revalidate: 60 } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ads?: PublicAd[] } | null) => {
        setFallback(data?.ads ?? []);
      })
      .catch(() => setFallback([]));
  }, [ctx, placement]);

  if (ctx) {
    if (!placement) return ctx.ads;
    return ctx.ads.filter((ad) => ad.placement === placement);
  }
  return fallback;
}
