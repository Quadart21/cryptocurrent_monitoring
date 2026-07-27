import { NextResponse } from "next/server";
import { confirmReviewEmail } from "@/lib/store";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { rateLimitedResponse } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = rateLimit(`review-confirm:${clientIp(request)}`, 20, 15 * 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Нет токена подтверждения" }, { status: 400 });
  }

  const review = await confirmReviewEmail(token);
  if (!review) {
    return NextResponse.json(
      {
        error:
          "Ссылка недействительна или устарела. Оставьте отзыв ещё раз.",
      },
      { status: 410 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Email подтверждён. Отзыв отправлен на модерацию и появится после проверки.",
    review: {
      id: review.id,
      exchangerSlug: review.exchangerSlug,
      status: review.status,
    },
  });
}
