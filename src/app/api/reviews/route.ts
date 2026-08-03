import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  addReview,
  deleteReviewHard,
  getExchangerBySlug,
  getSeoSettings,
  listQualityTags,
  listReviewsPaged,
} from "@/lib/store";
import type { ReviewSentiment } from "@/lib/store-types";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { rateLimitedResponse } from "@/lib/security/request";
import { siteBaseUrl } from "@/lib/email/service";
import { sendReviewConfirmEmail } from "@/lib/owner-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PAGE_SIZE = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exchangerId = searchParams.get("exchangerId") ?? undefined;
  const slug = searchParams.get("slug");
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const limitRaw = Number(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE));
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(50, Math.floor(limitRaw))
      : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  let id = exchangerId;
  if (!id && slug) {
    const ex = await getExchangerBySlug(slug);
    if (!ex || ex.status !== "active") {
      return NextResponse.json({
        reviews: [],
        tags: [],
        total: 0,
        page: 1,
        pageSize,
      });
    }
    id = ex.id;
  }

  const [{ items: reviews, total }, tags] = await Promise.all([
    listReviewsPaged({
      exchangerId: id,
      status: "approved",
      limit: pageSize,
      offset,
    }),
    listQualityTags({ activeOnly: true }),
  ]);

  const { listReviewRepliesForReviews } = await import("@/lib/review-threads");
  const repliesMap = await listReviewRepliesForReviews(reviews.map((r) => r.id));

  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.label]));
  const mapped = reviews.map((r) => ({
    id: r.id,
    exchangerName: r.exchangerName,
    exchangerSlug: r.exchangerSlug,
    sentiment: r.sentiment,
    orderId: r.orderId,
    text: r.text,
    createdAt: r.createdAt,
    ownerReply: r.ownerReply,
    ownerRepliedAt: r.ownerRepliedAt,
    threadClosed: r.threadClosed,
    replies: repliesMap.get(r.id) ?? [],
    qualityLabels: r.qualityTagIds
      .map((tid) => tagMap[tid])
      .filter(Boolean),
  }));

  return NextResponse.json({
    reviews: mapped,
    tags,
    total,
    page,
    pageSize,
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
    email?: string;
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
  const email = (body.email ?? "").trim().toLowerCase();
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
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Укажите корректный email для подтверждения" },
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

  const rawToken = randomBytes(32).toString("base64url");
  const confirmTokenHash = createHash("sha256").update(rawToken).digest("hex");
  const confirmExpiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

  let reviewId: string | null = null;

  try {
    const review = await addReview({
      exchangerId,
      sentiment,
      orderId,
      text,
      qualityTagIds,
      email,
      confirmTokenHash,
      confirmExpiresAt,
    });
    reviewId = review.id;

    const seo = await getSeoSettings();
    const base =
      siteBaseUrl(seo.siteUrl) ||
      (() => {
        const proto = request.headers.get("x-forwarded-proto") ?? "https";
        const host =
          request.headers.get("x-forwarded-host") ??
          request.headers.get("host");
        return host ? `${proto}://${host}` : "http://localhost:3000";
      })();
    const confirmUrl = `${base}/reviews/confirm?token=${encodeURIComponent(rawToken)}`;

    await sendReviewConfirmEmail({
      to: email,
      exchangerName: review.exchangerName,
      orderId: review.orderId,
      confirmUrl,
    });

    return NextResponse.json({
      ok: true,
      needsEmailConfirm: true,
      message:
        "Мы отправили письмо со ссылкой. Подтвердите email — после этого отзыв попадёт на модерацию.",
      review: { id: review.id, status: review.status },
    });
  } catch (error) {
    if (reviewId) {
      await deleteReviewHard(reviewId).catch(() => undefined);
    }
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить отзыв";
    const isMail =
      message.includes("smtp.bz") ||
      message.includes("SMTPBZ_") ||
      message.includes("RESEND_") ||
      message.includes("Resend") ||
      message.includes("smtp") ||
      message.includes("fromEmail");
    return NextResponse.json(
      {
        error: isMail
          ? "Не удалось отправить письмо подтверждения. Проверьте email или попробуйте позже."
          : message,
      },
      { status: isMail ? 502 : 422 },
    );
  }
}
