import { NextResponse } from "next/server";
import { hashOwnerPassword } from "@/lib/owner-auth";
import { sendOwnerAccessRemindEmail } from "@/lib/owner-mail";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import {
  assertSameOrigin,
  rateLimitedResponse,
} from "@/lib/security/request";
import {
  findExchangerByOwnerLogin,
  findExchangersByOwnerEmail,
  getSeoSettings,
  resetOwnerAccessForRemind,
} from "@/lib/store";
import {
  generateOwnerTempPassword,
  generateTotpSecret,
  totpAuthUri,
} from "@/lib/totp";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_OK =
  "Если этот email привязан к обменнику, мы отправили данные для входа в кабинет.";

function suggestOwnerLogin(slug: string, email: string): string {
  const fromSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
  if (fromSlug.length >= 2) return fromSlug;
  const local = email.split("@")[0]?.replace(/[^a-z0-9]+/gi, "_") ?? "owner";
  return local.toLowerCase().slice(0, 28) || "owner";
}

async function uniqueOwnerLogin(base: string, exchangerId: string): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const existing = await findExchangerByOwnerLogin(candidate);
    if (!existing || existing.id === exchangerId) return candidate;
    candidate = `${base}_${n}`.slice(0, 32);
    n += 1;
    if (n > 50) {
      candidate = `${base}_${Date.now().toString(36)}`.slice(0, 32);
      return candidate;
    }
  }
}

export async function POST(request: Request) {
  const originDenied = assertSameOrigin(request);
  if (originDenied) return originDenied;

  const ip = clientIp(request);
  const limited = rateLimit(`owner-remind:${ip}`, 5, 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  let body: { email?: string; turnstileToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const captcha = await verifyTurnstileToken({
    token: body.turnstileToken,
    request,
    expectedAction: "owner-remind",
  });
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 403 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Укажите корректный email" },
      { status: 400 },
    );
  }

  const emailLimited = rateLimit(`owner-remind-email:${email}`, 3, 15 * 60_000);
  if (!emailLimited.ok) {
    // Same generic response — do not reveal rate-limit on email
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  }

  const matches = await findExchangersByOwnerEmail(email);
  const seo = await getSeoSettings();
  const issuer = seo.siteName || "GapSnap";

  for (const ex of matches) {
    try {
      const baseLogin =
        ex.ownerLogin?.trim().toLowerCase() ||
        suggestOwnerLogin(ex.slug, email);
      const ownerLogin = await uniqueOwnerLogin(baseLogin, ex.id);
      const tempPassword = generateOwnerTempPassword();
      const passwordHash = await hashOwnerPassword(tempPassword);

      const needsTotp = !ex.ownerTotpEnabled || !ex.ownerTotpSecret;
      const totpSecret = needsTotp ? generateTotpSecret() : null;

      await resetOwnerAccessForRemind(ex.id, {
        ownerLogin,
        ownerPasswordHash: passwordHash,
        totpSecret,
        ownerEmail: email,
      });

      await sendOwnerAccessRemindEmail({
        to: email,
        exchangerName: ex.name,
        ownerLogin,
        tempPassword,
        totpSecret,
        totpUri: totpSecret
          ? totpAuthUri(totpSecret, ownerLogin, issuer)
          : null,
        totpAlreadyEnabled: Boolean(ex.ownerTotpEnabled && ex.ownerTotpSecret),
      });
    } catch (error) {
      console.error("[gapsnap] owner access remind failed", ex.id, error);
    }
  }

  // Always generic — do not reveal whether the email exists
  return NextResponse.json({ ok: true, message: GENERIC_OK });
}
