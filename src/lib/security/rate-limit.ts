type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Hard cap: drop oldest half if still too large (memory DoS guard)
  if (buckets.size > MAX_BUCKETS) {
    const keys = [...buckets.keys()].slice(0, Math.floor(buckets.size / 2));
    for (const key of keys) buckets.delete(key);
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Simple in-memory fixed window rate limit. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true };
}

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  return "unknown";
}

export type ApiRateTier = "auth" | "write" | "track" | "search" | "read" | "sync";

/** Tiered limits for public/API abuse (application DoS). Not a substitute for edge DDoS. */
export function apiRateLimitForPath(
  pathname: string,
  method: string,
): { tier: ApiRateTier; limit: number; windowMs: number } {
  const m = method.toUpperCase();

  if (
    pathname === "/api/admin/login" ||
    pathname === "/api/owner/login"
  ) {
    return {
      tier: "auth",
      limit: envInt("RATE_LIMIT_AUTH_PER_MIN", 8),
      windowMs: 60_000,
    };
  }

  if (pathname === "/api/admin/sync" || pathname === "/api/sync" || pathname === "/api/admin/news/sync") {
    return {
      tier: "sync",
      limit: envInt("RATE_LIMIT_SYNC_PER_MIN", 4),
      windowMs: 60_000,
    };
  }

  if (
    pathname === "/api/apply" ||
    (pathname === "/api/reviews" && m === "POST")
  ) {
    return {
      tier: "write",
      limit: envInt("RATE_LIMIT_WRITE_PER_MIN", 12),
      windowMs: 60_000,
    };
  }

  if (pathname.endsWith("/track") || pathname.includes("/track")) {
    return {
      tier: "track",
      limit: envInt("RATE_LIMIT_TRACK_PER_MIN", 90),
      windowMs: 60_000,
    };
  }

  if (pathname === "/api/search") {
    return {
      tier: "search",
      limit: envInt("RATE_LIMIT_SEARCH_PER_MIN", 40),
      windowMs: 60_000,
    };
  }

  return {
    tier: "read",
    limit: envInt("RATE_LIMIT_API_PER_MIN", 180),
    windowMs: 60_000,
  };
}

export function checkApiRateLimit(
  request: Request,
  pathname: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const { tier, limit, windowMs } = apiRateLimitForPath(
    pathname,
    request.method,
  );
  const ip = clientIp(request);
  return rateLimit(`api:${tier}:${ip}`, limit, windowMs);
}

/** Reject oversized JSON/body early (Content-Length). */
export function assertContentLength(
  request: Request,
  maxBytes: number,
): Response | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > maxBytes) {
    return new Response(JSON.stringify({ error: "payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
