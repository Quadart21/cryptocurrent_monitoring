import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminSessionToken,
  warnIfInsecureAdminConfig,
} from "@/lib/admin-auth";
import { authenticateAdmin } from "@/lib/admin-users";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import {
  assertSameOrigin,
  rateLimitedResponse,
} from "@/lib/security/request";
import { runMigrations } from "@/db/migrate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  warnIfInsecureAdminConfig();
  await runMigrations();

  const originDenied = assertSameOrigin(request);
  if (originDenied) return originDenied;

  const limited = rateLimit(`admin-login:${clientIp(request)}`, 8, 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  let body: { login?: string; password?: string; totpCode?: string };
  try {
    body = (await request.json()) as {
      login?: string;
      password?: string;
      totpCode?: string;
    };
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const result = await authenticateAdmin({
    login: body.login?.trim() ?? "",
    password: body.password ?? "",
    totpCode: body.totpCode,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        needsTotp: result.needsTotp ?? false,
        needsTotpSetup: !result.needsTotp && false,
      },
      { status: 401 },
    );
  }

  const token = await createAdminSessionToken(result.user.id);
  const response = NextResponse.json({
    ok: true,
    me: {
      id: result.user.id,
      login: result.user.login,
      role: result.user.role,
      totpEnabled: result.user.totpEnabled,
    },
  });
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
