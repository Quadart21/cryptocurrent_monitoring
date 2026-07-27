import { NextResponse } from "next/server";
import { getAdPricing, listAdTariffs } from "@/lib/store";
import {
  AD_PERIOD_LABELS,
  AD_PLACEMENT_HINTS,
  AD_PLACEMENT_LABELS,
  AD_TYPE_LABELS,
  BANNER_SPECS,
  formatAdPrice,
} from "@/lib/ads";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  const [tariffs, pricing] = await Promise.all([
    listAdTariffs({ activeOnly: true }),
    getAdPricing(),
  ]);

  return NextResponse.json({
    pricing,
    tariffs: tariffs.map((t) => ({
      ...t,
      priceLabel: formatAdPrice(t.price, t.currency),
      periodLabel: AD_PERIOD_LABELS[t.period],
      placementLabel: AD_PLACEMENT_LABELS[t.placement],
      typeLabel: AD_TYPE_LABELS[t.type],
      placementHint: AD_PLACEMENT_HINTS[t.placement],
      bannerSpec: BANNER_SPECS[t.placement] ?? null,
    })),
  });
}
