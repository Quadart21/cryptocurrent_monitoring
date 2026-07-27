import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  getLastGlobalSyncAt,
  getRatesCount,
  listAchievements,
  listAds,
  listBlacklist,
  listExchangers,
  listQualityTags,
  listReviews,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;

  const [
    lastGlobalSyncAt,
    ratesCount,
    exchangers,
    blacklist,
    reviews,
    qualityTags,
    achievements,
    ads,
  ] = await Promise.all([
    getLastGlobalSyncAt(),
    getRatesCount(),
    listExchangers(),
    listBlacklist(),
    listReviews(),
    listQualityTags(),
    listAchievements(),
    listAds(),
  ]);

  const tagMap = Object.fromEntries(qualityTags.map((t) => [t.id, t.label]));
  const reviewsWithLabels = reviews.map((r) => ({
    ...r,
    qualityLabels: r.qualityTagIds.map((id) => tagMap[id]).filter(Boolean),
  }));

  return NextResponse.json({
    lastGlobalSyncAt,
    counts: {
      exchangers: exchangers.length,
      active: exchangers.filter((e) => e.status === "active").length,
      pending: exchangers.filter((e) => e.status === "pending").length,
      error: exchangers.filter((e) => e.status === "error").length,
      rates: ratesCount,
      blacklist: blacklist.length,
      pendingReviews: reviews.filter((r) => r.status === "pending").length,
      achievements: achievements.length,
      ads: ads.length,
    },
    exchangers: exchangers.map(({ ownerPasswordHash: _hash, ...ex }) => ({
      ...ex,
      hasOwnerPassword: Boolean(_hash),
    })),
    blacklist,
    reviews: reviewsWithLabels,
    qualityTags,
    achievements,
    ads: ads.map((ad) => ({
      ...ad,
      stats: {
        ...ad.stats,
        daily: [...(ad.stats?.daily ?? [])]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 14),
      },
    })),
  });
}
