import { NextResponse } from "next/server";
import {
  addReview,
  getExchangerBySlug,
  listQualityTags,
  listReviews,
} from "@/lib/store";
import type { ReviewSentiment } from "@/lib/store-types";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { rateLimitedResponse } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exchangerId = searchParams.get("exchangerId") ?? undefined;
  const slug = searchParams.get("slug");

  let id = exchangerId;
  if (!id && slug) {
    const ex = await getExchangerBySlug(slug);
    if (!ex || ex.status !== "active") {
      return NextResponse.json({ reviews: [], tags: [] });
    }
    id = ex.id;
  }

  const [reviews, tags] = await Promise.all([
    listReviews({ exchangerId: id, status: "approved" }),
    listQualityTags({ activeOnly: true }),
  ]);

  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.label]));

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      sentiment: r.sentiment,
      orderId: r.orderId,
      text: r.text,
      createdAt: r.createdAt,
      ownerReply: r.ownerReply,
      ownerRepliedAt: r.ownerRepliedAt,
      qualityLabels: r.qualityTagIds
        .map((tid) => tagMap[tid])
        .filter(Boolean),
    })),
    tags,
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(`review:${clientIp(request)}`, 10, 15 * 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  let body: {
    exchangerId?: string;
    sentiment?: ReviewSentiment;
    orderId?: string;
    text?: string;
    qualityTagIds?: string[];
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const exchangerId = body.exchangerId?.trim() ?? "";
  const sentiment = body.sentiment;
  const orderId = body.orderId?.trim() ?? "";
  const text = body.text?.trim() ?? "";
  const qualityTagIds = Array.isArray(body.qualityTagIds)
    ? body.qualityTagIds.filter((x): x is string => typeof x === "string")
    : [];

  if (!exchangerId) {
    return NextResponse.json({ error: "Укажите обменник" }, { status: 400 });
  }
  if (sentiment !== "positive" && sentiment !== "negative") {
    return NextResponse.json(
      { error: "Выберите положительный или отрицательный отзыв" },
      { status: 400 },
    );
  }
  if (orderId.length < 1) {
    return NextResponse.json(
      { error: "Укажите номер заявки в обменнике" },
      { status: 400 },
    );
  }
  if (text.length < 10) {
    return NextResponse.json(
      { error: "Отзыв должен быть не короче 10 символов" },
      { status: 400 },
    );
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { error: "Отзыв слишком длинный (макс. 2000 символов)" },
      { status: 400 },
    );
  }

  try {
    const review = await addReview({
      exchangerId,
      sentiment,
      orderId,
      text,
      qualityTagIds,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Отзыв отправлен на модерацию. После проверки он появится на странице обменника.",
      review: { id: review.id, status: review.status },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить отзыв";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
