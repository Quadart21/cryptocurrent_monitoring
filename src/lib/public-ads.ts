import "server-only";

import { listActiveAds } from "@/lib/store";
import type { PublicAd } from "@/components/ads/ads-context";

export async function getPublicAds(): Promise<PublicAd[]> {
  const ads = await listActiveAds();
  return ads.map((ad) => ({
    id: ad.id,
    type: ad.type,
    placement: ad.placement,
    title: ad.title,
    body: ad.body,
    href: ad.href,
    imageUrl: ad.imageUrl,
    image: ad.image,
    exchangerId: ad.exchangerId,
    pairs: ad.pairs ?? [],
    priority: ad.priority,
  }));
}
