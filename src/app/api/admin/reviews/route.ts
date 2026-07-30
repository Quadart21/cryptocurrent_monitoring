import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  extractEmail,
  sendOwnerNewReviewEmail,
} from "@/lib/owner-mail";
import {
  deleteReview,
  getExchangerById,
  listQualityTags,
  listReviews,
  moderateReview,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdminResource("reviews", "GET");
  if (denied) return denied;

  const [reviews, tags] = await Promise.all([
    listReviews(),
    listQualityTags(),
  ]);

  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.label]));

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      ...r,
      qualityLabels: r.qualityTagIds
        .map((id) => tagMap[id])
        .filter(Boolean),
    })),
  });
}

export async function PATCH(request: Request) {
  const denied = await assertAdminResource("reviews", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: string;
    status?: "approved" | "rejected";
  };

  if (!body.id || (body.status !== "approved" && body.status !== "rejected")) {
    return NextResponse.json(
      { error: "id and status (approved|rejected) required" },
      { status: 400 },
    );
  }

  const review = await moderateReview(body.id, body.status);
  if (!review) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let mailWarning: string | null = null;

  if (body.status === "approved") {
    try {
      const ex = await getExchangerById(review.exchangerId);
      const to =
        ex?.ownerEmail?.trim().toLowerCase() || extractEmail(ex?.contact);
      if (!to) {
        mailWarning =
          "Отзыв одобрен, но email владельца не найден — уведомление не отправлено.";
      } else {
        await sendOwnerNewReviewEmail({
          to,
          exchangerName: review.exchangerName,
          exchangerSlug: review.exchangerSlug,
          sentiment: review.sentiment,
          orderId: review.orderId,
          text: review.text,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ошибка отправки";
      mailWarning = `Отзыв одобрен, но письмо владельцу не ушло: ${message}`;
    }
  }

  return NextResponse.json({ review, mailWarning });
}

export async function DELETE(request: Request) {
  const denied = await assertAdminResource("reviews", request.method);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await deleteReview(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
