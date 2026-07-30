import "server-only";

import { createHash, randomBytes } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { reviewReplies, reviewReplyTokens, reviews } from "@/db/schema";
import { siteBaseUrl } from "@/lib/email/service";
import {
  extractEmail,
  sendOwnerThreadNotify,
  sendReviewerThreadNotify,
} from "@/lib/owner-mail";
import {
  getExchangerById,
  getSeoSettings,
  type ExchangerReview,
} from "@/lib/store";
import type { ReviewReply, ReviewReplyRole } from "@/lib/store-types";

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function mapReply(row: typeof reviewReplies.$inferSelect): ReviewReply {
  return {
    id: row.id,
    reviewId: row.reviewId,
    authorRole: row.authorRole as ReviewReplyRole,
    body: row.body,
    createdAt: row.createdAt,
  };
}

function roleLabel(role: ReviewReplyRole): string {
  if (role === "owner") return "представитель обменника";
  if (role === "admin") return "модератор GapSnap";
  return "автор отзыва";
}

export async function listReviewReplies(
  reviewId: string,
): Promise<ReviewReply[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reviewReplies)
    .where(eq(reviewReplies.reviewId, reviewId))
    .orderBy(asc(reviewReplies.createdAt));
  return rows.map(mapReply);
}

export async function listReviewRepliesForReviews(
  reviewIds: string[],
): Promise<Map<string, ReviewReply[]>> {
  const map = new Map<string, ReviewReply[]>();
  if (!reviewIds.length) return map;
  const db = getDb();
  const { inArray } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(reviewReplies)
    .where(inArray(reviewReplies.reviewId, reviewIds))
    .orderBy(asc(reviewReplies.createdAt));
  for (const row of rows) {
    const list = map.get(row.reviewId) ?? [];
    list.push(mapReply(row));
    map.set(row.reviewId, list);
  }
  return map;
}

async function issueReviewerToken(
  reviewId: string,
  email: string,
): Promise<string> {
  const db = getDb();
  const raw = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const now = new Date();
  await db.delete(reviewReplyTokens).where(eq(reviewReplyTokens.reviewId, reviewId));
  await db.insert(reviewReplyTokens).values({
    id: `rrt_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    reviewId,
    tokenHash,
    email: email.trim().toLowerCase(),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  });
  return raw;
}

export async function resolveReviewReplyToken(rawToken: string): Promise<{
  review: typeof reviews.$inferSelect;
  email: string;
} | null> {
  const token = rawToken.trim();
  if (!token || token.length < 16) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const now = new Date().toISOString();
  const [tok] = await db
    .select()
    .from(reviewReplyTokens)
    .where(eq(reviewReplyTokens.tokenHash, tokenHash))
    .limit(1);
  if (!tok || tok.expiresAt < now) return null;
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, tok.reviewId))
    .limit(1);
  if (!review || review.status !== "approved") return null;
  return { review, email: tok.email };
}

async function notifyAfterReply(input: {
  review: typeof reviews.$inferSelect;
  role: ReviewReplyRole;
  body: string;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  const preview = input.body;

  if (input.role === "owner" || input.role === "admin") {
    const authorEmail = input.review.email?.trim().toLowerCase();
    if (!authorEmail) return;
    const raw = await issueReviewerToken(input.review.id, authorEmail);
    await sendReviewerThreadNotify({
      to: authorEmail,
      exchangerName: input.review.exchangerName,
      exchangerSlug: input.review.exchangerSlug,
      replyText: preview,
      replyUrl: `${base}/reviews/reply?token=${encodeURIComponent(raw)}`,
      roleLabel: roleLabel(input.role),
    });
    return;
  }

  // reviewer replied → notify owner
  const ex = await getExchangerById(input.review.exchangerId);
  const to =
    ex?.ownerEmail?.trim().toLowerCase() ||
    extractEmail(ex?.contact ?? null);
  if (!to) return;
  await sendOwnerThreadNotify({
    to,
    exchangerName: input.review.exchangerName,
    exchangerSlug: input.review.exchangerSlug,
    replyText: preview,
  });
}

export async function addReviewReply(input: {
  reviewId: string;
  role: ReviewReplyRole;
  body: string;
  /** Required for owner replies */
  exchangerId?: string;
}): Promise<ReviewReply> {
  const text = input.body.trim();
  if (text.length < 2 || text.length > 2000) {
    throw new Error("Ответ должен быть от 2 до 2000 символов");
  }

  const db = getDb();
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, input.reviewId))
    .limit(1);
  if (!review) throw new Error("Отзыв не найден");
  if (review.status !== "approved") {
    throw new Error("Отвечать можно только на опубликованные отзывы");
  }
  if (review.threadClosed) {
    throw new Error("Обсуждение закрыто модератором");
  }
  if (input.role === "owner") {
    if (!input.exchangerId || input.exchangerId !== review.exchangerId) {
      throw new Error("Нет доступа к этому отзыву");
    }
  }

  const now = new Date().toISOString();
  const id = `rr_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const [row] = await db
    .insert(reviewReplies)
    .values({
      id,
      reviewId: review.id,
      authorRole: input.role,
      body: text,
      createdAt: now,
    })
    .returning();

  if (input.role === "owner") {
    await db
      .update(reviews)
      .set({ ownerReply: text, ownerRepliedAt: now })
      .where(eq(reviews.id, review.id));
  }

  try {
    await notifyAfterReply({ review, role: input.role, body: text });
  } catch (error) {
    console.error("[gapsnap] review thread notify failed", error);
  }

  return mapReply(row);
}

export async function setReviewThreadClosed(
  reviewId: string,
  closed: boolean,
): Promise<ExchangerReview | null> {
  const db = getDb();
  const [row] = await db
    .update(reviews)
    .set({ threadClosed: closed })
    .where(eq(reviews.id, reviewId))
    .returning();
  if (!row) return null;
  return {
    id: row.id,
    exchangerId: row.exchangerId,
    exchangerSlug: row.exchangerSlug,
    exchangerName: row.exchangerName,
    sentiment: row.sentiment as ExchangerReview["sentiment"],
    orderId: row.orderId,
    text: row.text,
    qualityTagIds: row.qualityTagIds ?? [],
    status: row.status as ExchangerReview["status"],
    createdAt: row.createdAt,
    moderatedAt: row.moderatedAt,
    ownerReply: row.ownerReply,
    ownerRepliedAt: row.ownerRepliedAt,
    threadClosed: row.threadClosed,
    email: row.email ?? null,
    emailVerifiedAt: row.emailVerifiedAt ?? null,
  };
}

export async function getReviewById(
  reviewId: string,
): Promise<typeof reviews.$inferSelect | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  return row ?? null;
}
