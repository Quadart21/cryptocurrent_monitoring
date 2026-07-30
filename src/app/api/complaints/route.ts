import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { addComplaint, confirmComplaintEmail } from "@/lib/complaints";
import { siteBaseUrl } from "@/lib/email/service";
import { sendComplaintConfirmEmail } from "@/lib/owner-mail";
import { getExchangerBySlug, getSeoSettings } from "@/lib/store";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { rateLimitedResponse } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const limited = rateLimit(`complaint:${clientIp(request)}`, 8, 15 * 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  const body = (await request.json()) as {
    exchangerId?: string;
    slug?: string;
    email?: string;
    text?: string;
    orderId?: string;
    relatedReviewId?: string;
    acknowledged?: boolean;
  };

  if (!body.acknowledged) {
    return NextResponse.json(
      {
        error:
          "Подтвердите, что сначала пытались решить вопрос через отзывы",
      },
      { status: 400 },
    );
  }

  let exchangerId = body.exchangerId?.trim();
  if (!exchangerId && body.slug) {
    const ex = await getExchangerBySlug(body.slug);
    exchangerId = ex?.id;
  }
  if (!exchangerId) {
    return NextResponse.json({ error: "Обменник не найден" }, { status: 404 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }

  const rawToken = randomBytes(32).toString("hex");
  const confirmTokenHash = createHash("sha256").update(rawToken).digest("hex");
  const confirmExpiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const complaint = await addComplaint({
      exchangerId,
      email,
      body: body.text ?? "",
      orderId: body.orderId,
      relatedReviewId: body.relatedReviewId ?? null,
      confirmTokenHash,
      confirmExpiresAt,
    });

    const seo = await getSeoSettings();
    const base = siteBaseUrl(seo.siteUrl);
    await sendComplaintConfirmEmail({
      to: email,
      exchangerName: complaint.exchangerName,
      confirmUrl: `${base}/complaints/confirm?token=${encodeURIComponent(rawToken)}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Проверьте почту и подтвердите жалобу по ссылке",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 400 },
    );
  }
}
