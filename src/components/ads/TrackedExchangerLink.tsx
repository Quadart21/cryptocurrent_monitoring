"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackAdClick, trackAdImpression } from "@/components/ads/track";

export function TrackedExchangerLink({
  href,
  className,
  adId,
  children,
}: {
  href: string;
  className?: string;
  adId?: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (adId) trackAdImpression(adId);
  }, [adId]);

  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (adId) trackAdClick(adId);
      }}
    >
      {children}
    </Link>
  );
}
