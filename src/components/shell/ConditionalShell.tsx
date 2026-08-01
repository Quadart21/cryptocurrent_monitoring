"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import type { PublicAd } from "@/components/ads/ads-context";

export function ConditionalShell({
  children,
  initialAds = [],
  brandLogoUrl,
  apiEnabled = true,
  contactEmail,
  contactTelegram,
}: {
  children: React.ReactNode;
  initialAds?: PublicAd[];
  brandLogoUrl?: string | null;
  apiEnabled?: boolean;
  contactEmail?: string | null;
  contactTelegram?: string | null;
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
  return (
    <AppShell
      initialAds={initialAds}
      brandLogoUrl={brandLogoUrl}
      apiEnabled={apiEnabled}
      contactEmail={contactEmail}
      contactTelegram={contactTelegram}
    >
      {children}
    </AppShell>
  );
}
