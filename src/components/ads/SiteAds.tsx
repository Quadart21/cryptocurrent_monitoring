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
        <div className="mx-auto max-w-[1400px] px-3 pt-4 sm:px-6 lg:px-8">
          <AdBannerSlot ads={header} priority />
        </div>
      ) : null}
      {children}
      {footer.length > 0 ? (
        <div className="mx-auto max-w-[1400px] px-3 pb-6 sm:px-6 lg:px-8">
          <AdBannerSlot ads={footer} />
        </div>
      ) : null}
    </>
  );
}

export function SiteAdsChrome({
  children,
  initialAds = [],
}: {
  children: React.ReactNode;
  initialAds?: PublicAd[];
}) {
  const [ads, setAds] = useState<PublicAd[]>(initialAds);

  useEffect(() => {
    // Soft refresh after hydration; SSR already reserved heights.
    let cancelled = false;
    void fetch("/api/ads", { next: { revalidate: 60 } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ads?: PublicAd[] } | null) => {
        if (!cancelled && data?.ads) setAds(data.ads);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ ads, ready: true }),
    [ads],
  );

  return (
    <AdsProvider value={value}>
      <SiteAdsInner>{children}</SiteAdsInner>
    </AdsProvider>
  );
}

export function DashboardAdSlot() {
  const ads = useAds("dashboard");
  if (!ads.length) return null;
  return <AdBannerSlot ads={ads} priority />;
}

export function HomeMidAdSlot() {
  const ads = useAds("home_mid");
  if (!ads.length) return null;
  return <AdBannerSlot ads={ads} />;
}

export function PairAfterAdSlot() {
  const ads = useAds("pair_after");
  if (!ads.length) return null;
  return <AdBannerSlot ads={ads} />;
}

export function ExchangerPageAdSlot() {
  const ads = useAds("exchanger_page");
  if (!ads.length) return null;
  return <AdBannerSlot ads={ads} />;
}
