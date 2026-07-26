"use client";

import { useEffect, useMemo, useState } from "react";
import { AdBannerSlot } from "@/components/ads/AdBanner";
import { AdTicker } from "@/components/ads/AdTicker";
import { AdsProvider } from "@/components/ads/ads-context";
import { useAds, type PublicAd } from "@/components/ads/useAds";

function SiteAdsInner({ children }: { children: React.ReactNode }) {
  const ticker = useAds("ticker");
  const header = useAds("header");
  const footer = useAds("footer");

  return (
    <>
      {ticker.length > 0 ? <AdTicker ads={ticker} /> : null}
      {header.length > 0 ? (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <AdBannerSlot ads={header} />
        </div>
      ) : null}
      {children}
      {footer.length > 0 ? (
        <div className="px-4 pb-6 sm:px-6 lg:px-8">
          <AdBannerSlot ads={footer} />
        </div>
      ) : null}
    </>
  );
}

export function SiteAdsChrome({ children }: { children: React.ReactNode }) {
  const [ads, setAds] = useState<PublicAd[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ads", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ads?: PublicAd[] } | null) => {
        if (!cancelled) {
          setAds(data?.ads ?? []);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAds([]);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ ads, ready }), [ads, ready]);

  return (
    <AdsProvider value={value}>
      <SiteAdsInner>{children}</SiteAdsInner>
    </AdsProvider>
  );
}

export function DashboardAdSlot() {
  const ads = useAds("dashboard");
  if (!ads.length) return null;
  return <AdBannerSlot ads={ads} />;
}
