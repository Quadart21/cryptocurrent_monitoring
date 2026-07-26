import type { ExchangerTraffic } from "@/lib/store-types";
import { utcDayKey } from "@/lib/ads";

export function emptyExchangerTraffic(): ExchangerTraffic {
  return {
    pageViews: 0,
    siteClicks: 0,
    lastViewAt: null,
    lastClickAt: null,
    daily: [],
  };
}

export function normalizeExchangerTraffic(
  raw: Partial<ExchangerTraffic> | null | undefined,
): ExchangerTraffic {
  const daily = Array.isArray(raw?.daily)
    ? raw!.daily
        .filter(
          (d) =>
            d &&
            typeof d.date === "string" &&
            typeof d.pageViews === "number" &&
            typeof d.siteClicks === "number",
        )
        .map((d) => ({
          date: d.date,
          pageViews: Math.max(0, d.pageViews),
          siteClicks: Math.max(0, d.siteClicks),
        }))
    : [];

  return {
    pageViews: Math.max(0, Number(raw?.pageViews) || 0),
    siteClicks: Math.max(0, Number(raw?.siteClicks) || 0),
    lastViewAt: typeof raw?.lastViewAt === "string" ? raw.lastViewAt : null,
    lastClickAt: typeof raw?.lastClickAt === "string" ? raw.lastClickAt : null,
    daily,
  };
}

/** Конверсия страница → сайт, % */
export function exchangerOutboundCtr(traffic: {
  pageViews: number;
  siteClicks: number;
}) {
  if (traffic.pageViews <= 0) return null;
  return Math.round((traffic.siteClicks / traffic.pageViews) * 10000) / 100;
}

export function formatOutboundCtr(traffic: {
  pageViews: number;
  siteClicks: number;
}) {
  const ctr = exchangerOutboundCtr(traffic);
  return ctr === null ? "—" : `${ctr.toFixed(2)}%`;
}

export { utcDayKey };
