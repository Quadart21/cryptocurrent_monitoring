"use client";

import { AnalyticsScripts } from "@/components/seo/AnalyticsScripts";
import { useConsent } from "@/components/consent/ConsentProvider";

/** GA4 / GTM only — Yandex Metrika is SSR-injected (needed for counter verification). */
export function ConsentAwareAnalytics({
  googleAnalyticsId,
  gtmId,
}: {
  googleAnalyticsId?: string;
  gtmId?: string;
}) {
  const { ready, analyticsAllowed } = useConsent();

  if (!ready || !analyticsAllowed) return null;
  if (!googleAnalyticsId?.trim() && !gtmId?.trim()) return null;

  return (
    <AnalyticsScripts googleAnalyticsId={googleAnalyticsId} gtmId={gtmId} />
  );
}
