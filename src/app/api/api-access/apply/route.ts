import { NextResponse } from "next/server";
import { createApiClientApplication } from "@/lib/public-api/auth";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { rateLimitedResponse } from "@/lib/security/request";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const limited = rateLimit(
    `api-access-apply:${clientIp(request)}`,
    5,
    15 * 60_000,
  );
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  let body: {
    name?: string;
    email?: string;
    website?: string;
    purpose?: string;
    turnstileToken?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const captcha = await verifyTurnstileToken({
    token: String(body.turnstileToken ?? ""),
    request,
    expectedAction: "api-access",
  });
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const website = String(body.website ?? "").trim();
  const purpose = String(body.purpose ?? "").trim();

  if (name.length < 2) {
    return NextResponse.json({ error: "Укажите имя или название проекта" }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }
  if (purpose.length < 10) {
    return NextResponse.json(
      { error: "Опишите цель использования API (минимум 10 символов)" },
      { status: 400 },
    );
  }
  if (purpose.length > 2000) {
    return NextResponse.json({ error: "Слишком длинное описание" }, { status: 400 });
  }

  const client = await createApiClientApplication({
    name: name.slice(0, 120),
    email: email.slice(0, 200),
    website: website.slice(0, 500),
    purpose: purpose.slice(0, 2000),
  });

  return NextResponse.json({
    ok: true,
    message:
      "Заявка принята. После проверки мы отправим API-ключ на указанный email.",
    id: client.id,
  });
}
