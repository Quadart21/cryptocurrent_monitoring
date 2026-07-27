import { NextResponse } from "next/server";
import { listExchangers } from "@/lib/store";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  const exchangers = await listExchangers({ publicOnly: true });
  return NextResponse.json({
    exchangers: exchangers.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      website: e.website,
      feedUrl: e.feedUrl,
      description: e.description,
      status: e.status,
      verified: e.verified,
      rating: e.rating,
      reviews: e.reviews,
      ageYears: e.ageYears,
      pairCount: e.pairCount,
      lastSyncAt: e.lastSyncAt,
      lastError: e.lastError,
    })),
  });
}
