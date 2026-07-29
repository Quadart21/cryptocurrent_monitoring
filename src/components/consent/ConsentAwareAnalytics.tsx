"use client";

import { AnalyticsScripts } from "@/components/seo/AnalyticsScripts";
import { useConsent } from "@/components/consent/ConsentProvider";

export function ConsentAwareAnalytics({
  googleAnalyticsId,
  yandexMetricaId,
  gtmId,
}: {
  googleAnalyticsId?: string;
  yandexMetricaId?: string;
  gtmId?: string;
}) {
  const { ready, analyticsAllowed } = useConsent();

  if (!ready || !analyticsAllowed) return null;

  return (
    <AnalyticsScripts
      googleAnalyticsId={googleAnalyticsId}
      yandexMetricaId={yandexMetricaId}
      gtmId={gtmId}
    />
  );
}
