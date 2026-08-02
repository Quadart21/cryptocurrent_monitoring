import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_INTERNAL_PATH,
  ADMIN_PATH,
  isAdminInternalPath,
  isAdminPublicPath,
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

/** Default JSON API body cap. Upload routes use a higher ceiling. */
const API_BODY_MAX_BYTES = 1_000_000;
/** Ad banners/videos + logos + apply form (must cover AD_VIDEO_MAX_BYTES). */
const API_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

function uploadBodyMaxBytes(pathname: string): number {
  if (
    pathname === "/api/admin/ads/image" ||
    pathname === "/api/admin/exchangers/logo" ||
    pathname === "/api/admin/branding" ||
    pathname === "/api/apply" ||
    pathname === "/api/internal/news-cover"
  ) {
    return API_UPLOAD_MAX_BYTES;
  }
  return API_BODY_MAX_BYTES;
}

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

function withNoIndex(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = (process.env.GAPSNAP_ROLE ?? "all").trim().toLowerCase();
  const isWorkerOnly =
    role === "worker" || role === "poller" || role === "jobs";

  // Dedicated worker: only internal API + health (no public site surface).
  if (isWorkerOnly) {
    if (
      pathname === "/api/health" ||
      pathname === "/api/internal/worker" ||
      pathname.startsWith("/api/internal/")
    ) {
      return NextResponse.next();
    }
    return new NextResponse("Worker node — not a public origin", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Custom public admin URL → rewrite to internal /trulala app routes
  if (ADMIN_PATH !== ADMIN_INTERNAL_PATH && isAdminPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    const rest =
      pathname === ADMIN_PATH ? "" : pathname.slice(ADMIN_PATH.length);
    url.pathname = `${ADMIN_INTERNAL_PATH}${rest}`;
    return withNoIndex(NextResponse.rewrite(url));
  }

  // Hide canonical filesystem path when a custom ADMIN_PATH is configured
  if (ADMIN_PATH !== ADMIN_INTERNAL_PATH && isAdminInternalPath(pathname)) {
    return withNoIndex(
      new NextResponse("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }

  if (isAdminPublicPath(pathname) || isAdminInternalPath(pathname)) {
    const res = NextResponse.next();
    return withNoIndex(res);
  }

  // Application-layer DoS shield for all APIs (+ public /v2 partner API)
  if (pathname.startsWith("/api/") || pathname.startsWith("/v2/")) {
    const tooBig = assertContentLength(
      request,
      uploadBodyMaxBytes(pathname),
    );
    if (tooBig) return tooBig;

    const limited = checkApiRateLimit(request, pathname);
    if (!limited.ok) return rateLimited(limited.retryAfterSec);
  }

  if (pathname.startsWith("/v2/")) {
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on app routes (needed for custom ADMIN_PATH rewrite) + APIs.
     * Skip Next static assets and files with extensions.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/:path*",
  ],
};
