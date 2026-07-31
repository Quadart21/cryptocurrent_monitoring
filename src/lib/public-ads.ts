import "server-only";

import { listActiveAds, listExchangerAdPathsByIds } from "@/lib/store";
import type { PublicAd } from "@/components/ads/ads-context";

export async function getPublicAds(): Promise<PublicAd[]> {
  const ads = await listActiveAds();
  const linkIds = ads
    .filter(
      (ad) =>
        (ad.type === "banner" || ad.type === "ticker") && ad.exchangerId,
    )
    .map((ad) => ad.exchangerId!)
    .filter(Boolean);
  const paths = await listExchangerAdPathsByIds(linkIds);

  return ads.map((ad) => {
    let href = ad.href;
    if (
      (ad.type === "banner" || ad.type === "ticker") &&
      ad.exchangerId
    ) {
      href = paths.get(ad.exchangerId) ?? "";
    }
    return {
      id: ad.id,
      type: ad.type,
      placement: ad.placement,
      title: ad.title,
      body: ad.body,
      href,
      imageUrl: ad.imageUrl,
      image: ad.image,
      exchangerId: ad.exchangerId,
      pairs: ad.pairs ?? [],
      priority: ad.priority,
    };
  });
}
