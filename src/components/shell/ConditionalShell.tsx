"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import type { PublicAd } from "@/components/ads/ads-context";

export function ConditionalShell({
  children,
  initialAds = [],
}: {
  children: React.ReactNode;
  initialAds?: PublicAd[];
}) {
  const pathname = usePathname();
  if (
    pathname === "/trulala" ||
    pathname.startsWith("/trulala/") ||
    pathname === "/cabinet" ||
    pathname.startsWith("/cabinet/")
  ) {
    return <>{children}</>;
  }
  return <AppShell initialAds={initialAds}>{children}</AppShell>;
}
