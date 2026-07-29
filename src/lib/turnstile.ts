import "server-only";

import { clientIp } from "@/lib/security/rate-limit";

export type TurnstileVerifyResult =
  | { ok: true; hostname: string | null }
  | { ok: false; error: string };

type SiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

function turnstileSecret(): string {
  return (
    process.env.TURNSTILE_SECRET_KEY?.trim() ||
    process.env.TURNSTILE_SECRET?.trim() ||
    ""
  );
}

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
}

export function isTurnstileConfigured(): boolean {
  return Boolean(turnstileSecret() && turnstileSiteKey());
}

function allowedHostnames(): Set<string> | null {
  const raw = process.env.TURNSTILE_HOSTNAMES?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Validates a Turnstile token via Cloudflare Siteverify.
 * When keys are not configured: fail closed in production, skip in development.
 */
export async function verifyTurnstileToken(input: {
  token: string | null | undefined;
  request: Request;
  expectedAction?: string;
}): Promise<TurnstileVerifyResult> {
  const secret = turnstileSecret();
  const siteKey = turnstileSiteKey();
  const configured = Boolean(secret && siteKey);

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "Проверка Turnstile не настроена на сервере",
      };
    }
    return { ok: true, hostname: null };
  }

  const token = String(input.token ?? "").trim();
  if (!token || token.length > 2048) {
    return { ok: false, error: "Пройдите проверку Cloudflare" };
  }

  let result: SiteverifyResponse;
  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    const ip = clientIp(input.request);
    if (ip && ip !== "unknown") body.set("remoteip", ip);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      return { ok: false, error: "Не удалось проверить Turnstile" };
    }
    result = (await res.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, error: "Не удалось проверить Turnstile" };
  }

  if (!result.success) {
    return { ok: false, error: "Проверка Cloudflare не пройдена" };
  }

  if (
    input.expectedAction &&
    result.action &&
    result.action !== input.expectedAction
  ) {
    return { ok: false, error: "Проверка Cloudflare не пройдена" };
  }

  const hosts = allowedHostnames();
  const hostname = result.hostname?.toLowerCase() ?? null;
  if (hosts && hostname && !hosts.has(hostname)) {
    return { ok: false, error: "Проверка Cloudflare не пройдена" };
  }

  return { ok: true, hostname };
}
