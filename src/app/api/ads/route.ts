import { NextResponse } from "next/server";
import { listActiveAds } from "@/lib/store";
import type { AdPlacement } from "@/lib/store-types";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: Request) {
  const placement = new URL(request.url).searchParams.get(
    "placement",
  ) as AdPlacement | null;

  const ads = await listActiveAds(
    placement ? { placement } : undefined,
  );

  return NextResponse.json({
    ads: ads.map((ad) => ({
      id: ad.id,
      type: ad.type,
      placement: ad.placement,
      title: ad.title,
      body: ad.body,
      href: ad.href,
      imageUrl: ad.imageUrl,
      exchangerId: ad.exchangerId,
      priority: ad.priority,
    })),
  });
}
