import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { countPendingCatalogProposals } from "@/lib/bestchange/catalog-proposals";
import { countPendingComplaints } from "@/lib/complaints";
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

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  const shown = user.length <= 2 ? `${user[0] ?? "*"}*` : `${user.slice(0, 2)}***`;
  return `${shown}@${domain}`;
}

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
    pendingCatalog,
    pendingComplaints,
  ] = await Promise.all([
    getLastGlobalSyncAt(),
    getRatesCount(),
    listExchangers(),
    listBlacklist(),
    listReviews(),
    listQualityTags(),
    listAchievements(),
    listAds(),
    countPendingCatalogProposals(),
    countPendingComplaints(),
  ]);

  const tagMap = Object.fromEntries(qualityTags.map((t) => [t.id, t.label]));
  const visibleReviews = reviews.filter((r) => r.status !== "awaiting_email");
  const reviewsWithLabels = visibleReviews.map((r) => ({
    ...r,
    email: r.email ? maskEmail(r.email) : null,
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
      pendingReviews: visibleReviews.filter((r) => r.status === "pending").length,
      pendingComplaints,
      pendingCatalog,
      achievements: achievements.length,
      ads: ads.length,
      bannerMissing: exchangers.filter(
        (e) =>
          e.status === "active" &&
          (e.bannerCheck?.status === "missing" ||
            e.bannerCheck?.status === "error"),
      ).length,
    },
    exchangers: exchangers.map(
      ({
        ownerPasswordHash: _hash,
        ownerTotpSecret: _totp,
        ...ex
      }) => ({
        ...ex,
        hasOwnerPassword: Boolean(_hash),
        ownerTotpEnabled: Boolean(ex.ownerTotpEnabled),
      }),
    ),
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
