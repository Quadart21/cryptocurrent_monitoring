import { NextResponse } from "next/server";
import {
  addReviewReply,
  listReviewReplies,
  resolveReviewReplyToken,
} from "@/lib/review-threads";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { rateLimitedResponse } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const resolved = await resolveReviewReplyToken(token);
  if (!resolved) {
    return NextResponse.json(
      { error: "Ссылка недействительна или устарела" },
      { status: 404 },
    );
  }
  const replies = await listReviewReplies(resolved.review.id);
  return NextResponse.json({
    review: {
      id: resolved.review.id,
      exchangerName: resolved.review.exchangerName,
      exchangerSlug: resolved.review.exchangerSlug,
      text: resolved.review.text,
      sentiment: resolved.review.sentiment,
      orderId: resolved.review.orderId,
      threadClosed: resolved.review.threadClosed,
      createdAt: resolved.review.createdAt,
    },
    replies,
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(`review-thread:${clientIp(request)}`, 20, 15 * 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  const body = (await request.json()) as { token?: string; reply?: string };
  const resolved = await resolveReviewReplyToken(body.token ?? "");
  if (!resolved) {
    return NextResponse.json(
      { error: "Ссылка недействительна или устарела" },
      { status: 404 },
    );
  }
  try {
    const reply = await addReviewReply({
      reviewId: resolved.review.id,
      role: "reviewer",
      body: body.reply ?? "",
    });
    const replies = await listReviewReplies(resolved.review.id);
    return NextResponse.json({ reply, replies });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 400 },
    );
  }
}
