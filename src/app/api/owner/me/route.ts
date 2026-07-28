import { NextResponse } from "next/server";
import { bannerEmbedHtml, bannerStatusLabel } from "@/lib/banner";
import { siteBaseUrl } from "@/lib/email/service";
import { formatOutboundCtr } from "@/lib/exchanger-traffic";
import { formatWorkingSince } from "@/lib/format";
import { assertOwner } from "@/lib/owner-guard";
import { getSeoSettings, listReviews } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertOwner();
  if (auth.error) return auth.error;
  const ex = auth.exchanger;

  const reviews = await listReviews({ exchangerId: ex.id });
  const traffic = ex.traffic ?? {
    pageViews: 0,
    siteClicks: 0,
    lastViewAt: null,
    lastClickAt: null,
    daily: [],
  };
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  const bannerHtml =
    ex.bannerToken && ex.status === "active"
      ? bannerEmbedHtml({
          siteUrl: base,
          token: ex.bannerToken,
          slug: ex.slug,
        })
      : null;

  return NextResponse.json({
    exchanger: {
      id: ex.id,
      slug: ex.slug,
      name: ex.name,
      website: ex.website,
      feedUrl: ex.feedUrl,
      contact: ex.contact,
      description: ex.description,
      status: ex.status,
      verified: ex.verified,
      rating: ex.rating,
      reviews: ex.reviews,
      reviewsPositive: ex.reviewsPositive,
      reviewsNegative: ex.reviewsNegative,
      pairCount: ex.pairCount,
      approvedAt: ex.approvedAt,
      lastSyncAt: ex.lastSyncAt,
      lastError: ex.lastError,
      workingSince: formatWorkingSince(ex.approvedAt),
      logo: ex.logo,
      bannerToken: ex.bannerToken,
      bannerStatus: bannerStatusLabel(ex.bannerCheck?.status ?? "pending"),
      bannerCheck: ex.bannerCheck,
      bannerHtml,
      traffic: {
        ...traffic,
        ctr: formatOutboundCtr(traffic),
        daily: [...(traffic.daily ?? [])]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30),
      },
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      sentiment: r.sentiment,
      orderId: r.orderId,
      text: r.text,
      status: r.status,
      createdAt: r.createdAt,
      moderatedAt: r.moderatedAt,
      ownerReply: r.ownerReply,
      ownerRepliedAt: r.ownerRepliedAt,
    })),
    readOnlyProfile: true,
  });
}
