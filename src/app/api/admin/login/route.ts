import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminSessionToken,
  isValidCredentials,
  warnIfInsecureAdminConfig,
} from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import {
  assertSameOrigin,
  rateLimitedResponse,
} from "@/lib/security/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  warnIfInsecureAdminConfig();

  const originDenied = assertSameOrigin(request);
  if (originDenied) return originDenied;

  const limited = rateLimit(`admin-login:${clientIp(request)}`, 8, 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  let body: { login?: string; password?: string };
  try {
    body = (await request.json()) as { login?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const login = body.login?.trim() ?? "";
  const password = body.password ?? "";

  if (!isValidCredentials(login, password)) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 },
    );
  }

  const token = await createAdminSessionToken(login);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
