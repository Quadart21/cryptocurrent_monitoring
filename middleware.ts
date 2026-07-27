import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_PATH,
  isValidAdminSession,
} from "@/lib/admin-auth";
import {
  OWNER_COOKIE,
  isOwnerSessionExpired,
  parseOwnerCookie,
} from "@/lib/owner-cookie";
import {
  assertContentLength,
  checkApiRateLimit,
} from "@/lib/security/rate-limit";
import { assertSameOrigin } from "@/lib/security/request";

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Слишком много запросов. Подождите и попробуйте снова." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Application-layer DoS shield for all APIs
  if (pathname.startsWith("/api/")) {
    const tooBig = assertContentLength(request, 1_000_000);
    if (tooBig) return tooBig;

    const limited = checkApiRateLimit(request, pathname);
    if (!limited.ok) return rateLimited(limited.retryAfterSec);
  }

  if (pathname === "/api/admin/login" || pathname === "/api/owner/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/owner")) {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;
  }

  if (pathname.startsWith("/api/admin")) {
    const session = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!(await isValidAdminSession(session))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/owner")) {
    const parsed = parseOwnerCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!parsed || isOwnerSessionExpired(parsed.token)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (
    pathname === ADMIN_PATH ||
    pathname.startsWith(`${ADMIN_PATH}/`) ||
    pathname === "/cabinet" ||
    pathname.startsWith("/cabinet/")
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/trulala",
    "/trulala/:path*",
    "/cabinet",
    "/cabinet/:path*",
    "/api/:path*",
  ],
};
