import { NextResponse } from "next/server";

/** Block obvious cross-site cookie-auth mutations (CSRF). */
export function assertSameOrigin(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: "forbidden origin" }, { status: 403 });
      }
      return null;
    } catch {
      return NextResponse.json({ error: "forbidden origin" }, { status: 403 });
    }
  }

  // No Origin (some same-site navigations / older clients): require site-ish Sec-Fetch-Site
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export function rateLimitedResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Слишком много запросов. Подождите и попробуйте снова." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
