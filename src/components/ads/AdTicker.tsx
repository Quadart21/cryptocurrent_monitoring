"use client";

import { useEffect, useMemo } from "react";
import type { PublicAd } from "@/components/ads/useAds";
import { trackAdClick, trackAdImpression } from "@/components/ads/track";
import { shuffleArray } from "@/lib/ads";

function TickerSegment({
  ads,
  keyPrefix,
}: {
  ads: PublicAd[];
  keyPrefix: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-10 pr-10">
      {ads.map((ad, i) => {
        const text = ad.body ? `${ad.title} — ${ad.body}` : ad.title;
        const className =
          "whitespace-nowrap text-sm text-ink hover:text-accent";
        const key = `${keyPrefix}-${ad.id}-${i}`;
        if (ad.href) {
          return (
            <a
              key={key}
              href={ad.href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className={className}
              onClick={() => trackAdClick(ad.id)}
            >
              {text}
            </a>
          );
        }
        return (
          <span key={key} className={className}>
            {text}
          </span>
        );
      })}
    </div>
  );
}

export function AdTicker({ ads }: { ads: PublicAd[] }) {
  const key = ads.map((a) => a.id).join("|");
  const shuffled = useMemo(
    () => shuffleArray(ads),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    for (const ad of shuffled) trackAdImpression(ad.id);
  }, [shuffled]);

  if (!shuffled.length) return null;

  const loop =
    shuffled.length === 1 ? [...shuffled, ...shuffled, ...shuffled] : shuffled;

  return (
    <div className="relative overflow-hidden border-b border-line bg-accent-soft/30">
      <p className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-md bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted shadow-sm">
        Реклама
      </p>
      <div className="ad-ticker-track py-2.5 pl-20">
        <TickerSegment ads={loop} keyPrefix="a" />
        <TickerSegment ads={loop} keyPrefix="b" />
      </div>
    </div>
  );
}
