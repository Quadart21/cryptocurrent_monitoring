import { NextResponse } from "next/server";
import {
  OWNER_COOKIE,
  encodeOwnerCookie,
  hashOwnerPassword,
  ownerSessionToken,
  verifyOwnerPassword,
} from "@/lib/owner-auth";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import {
  assertSameOrigin,
  rateLimitedResponse,
} from "@/lib/security/request";
import {
  findExchangerByOwnerLogin,
  setOwnerCredentials,
} from "@/lib/store";
import { verifyTotpCode } from "@/lib/totp";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originDenied = assertSameOrigin(request);
  if (originDenied) return originDenied;

  const limited = rateLimit(`owner-login:${clientIp(request)}`, 8, 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  let body: {
    login?: string;
    password?: string;
    totpCode?: string;
    turnstileToken?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const captcha = await verifyTurnstileToken({
    token: body.turnstileToken,
    request,
    expectedAction: "owner-login",
  });
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 403 });
  }

  const login = String(body.login ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const totpCode = String(body.totpCode ?? "").trim();
  if (login.length < 2 || password.length < 4) {
    return NextResponse.json(
      { error: "Укажите логин и пароль" },
      { status: 400 },
    );
  }

  const ex = await findExchangerByOwnerLogin(login);
  if (!ex?.ownerLogin || !ex.ownerPasswordHash) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 },
    );
  }

  const verified = await verifyOwnerPassword(password, ex.ownerPasswordHash);
  if (!verified.ok) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 },
    );
  }

  if (ex.ownerTotpEnabled && ex.ownerTotpSecret) {
    if (!totpCode) {
      return NextResponse.json(
        {
          needsTotp: true,
          error: "Введите код из приложения-аутентификатора",
        },
        { status: 401 },
      );
    }
    if (!verifyTotpCode(ex.ownerTotpSecret, totpCode)) {
      return NextResponse.json(
        { needsTotp: true, error: "Неверный код 2FA" },
        { status: 401 },
      );
    }
  }

  let passwordHash = ex.ownerPasswordHash;
  if (verified.needsRehash) {
    passwordHash = await hashOwnerPassword(password);
    await setOwnerCredentials(ex.id, {
      ownerLogin: ex.ownerLogin,
      ownerPasswordHash: passwordHash,
    });
  }

  const token = await ownerSessionToken({
    exchangerId: ex.id,
    ownerLogin: ex.ownerLogin,
    ownerPasswordHash: passwordHash,
  });

  const res = NextResponse.json({
    ok: true,
    exchanger: {
      id: ex.id,
      slug: ex.slug,
      name: ex.name,
      status: ex.status,
    },
  });

  res.cookies.set(OWNER_COOKIE, encodeOwnerCookie(ex.id, token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return res;
}
