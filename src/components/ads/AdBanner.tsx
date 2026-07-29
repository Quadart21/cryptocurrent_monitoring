"use client";

import { useEffect, useMemo, useRef } from "react";
import { BANNER_SPECS, pickWeightedRandom } from "@/lib/ads";
import { adMediaIsVideo } from "@/lib/ad-image-url";
import type { PublicAd } from "@/components/ads/useAds";
import { trackAdClick, trackAdImpression } from "@/components/ads/track";

function AdLabel() {
  return (
    <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white">
      Реклама
    </span>
  );
}

function AdMedia({ ad }: { ad: PublicAd }) {
  const isVideo = adMediaIsVideo({
    format: ad.image?.format,
    url: ad.imageUrl,
  });

  if (isVideo) {
    return (
      <video
        src={ad.imageUrl}
        className="pointer-events-none h-full w-full object-cover object-center"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={ad.title}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ad.imageUrl}
      alt={ad.title}
      className="h-full w-full object-cover object-center"
    />
  );
}

export function AdBanner({ ad }: { ad: PublicAd }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const spec = BANNER_SPECS[ad.placement];
  const href = ad.href.trim() || null;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4)) {
          trackAdImpression(ad.id);
          observer.disconnect();
        }
      },
      { threshold: [0.4] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ad.id]);

  const onClick = () => {
    trackAdClick(ad.id);
  };

  if (ad.imageUrl) {
    const frame = (
      <div
        ref={rootRef}
        className={`relative w-full overflow-hidden rounded-2xl border border-line bg-bg-soft ${spec?.aspectClass ?? "aspect-[6/1]"}`}
      >
        <AdLabel />
        <AdMedia ad={ad} />
      </div>
    );

    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block transition hover:opacity-95"
          title={ad.title}
          onClick={onClick}
        >
          {frame}
        </a>
      );
    }
    return frame;
  }

  const inner = (
    <div
      ref={rootRef}
      className="relative flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <AdLabel />
      <div className="min-w-0 flex-1 pt-4 sm:pt-0 sm:pl-14">
        <p className="font-display text-lg font-semibold text-ink">{ad.title}</p>
        {ad.body ? (
          <p className="mt-1 text-sm text-ink-muted">{ad.body}</p>
        ) : null}
      </div>
      {href ? (
        <span className="btn-primary inline-flex shrink-0 rounded-xl px-4 py-2 text-xs font-semibold">
          Подробнее
        </span>
      ) : null}
    </div>
  );

  const className =
    "block rounded-2xl border border-accent/25 bg-accent-soft/40 transition hover:border-accent/50";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={className}
        onClick={onClick}
      >
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function AdBannerSlot({ ads }: { ads: PublicAd[] }) {
  const key = ads.map((a) => `${a.id}:${a.priority}`).join("|");
  const selected = useMemo(
    () => pickWeightedRandom(ads),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-roll when set of ads changes
    [key],
  );

  if (!selected) return null;
  return (
    <div className="space-y-3">
      <AdBanner key={selected.id} ad={selected} />
    </div>
  );
}
