import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  getStore,
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
    store,
    exchangers,
    blacklist,
    reviews,
    qualityTags,
    achievements,
    ads,
  ] = await Promise.all([
    getStore(),
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
    lastGlobalSyncAt: store.lastGlobalSyncAt,
    counts: {
      exchangers: exchangers.length,
      active: exchangers.filter((e) => e.status === "active").length,
      pending: exchangers.filter((e) => e.status === "pending").length,
      error: exchangers.filter((e) => e.status === "error").length,
      rates: store.rates.length,
      blacklist: blacklist.length,
      pendingReviews: reviews.filter((r) => r.status === "pending").length,
      achievements: achievements.length,
      ads: ads.length,
    },
    exchangers,
    blacklist,
    reviews: reviewsWithLabels,
    qualityTags,
    achievements,
    ads,
  });
}
