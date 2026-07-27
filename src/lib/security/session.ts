/** Edge-safe session helpers (Web Crypto). No Node-only APIs. */

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 24) return fromEnv;

  const login = process.env.ADMIN_LOGIN?.trim() || "admin";
  const password = process.env.ADMIN_PASSWORD?.trim() || "admin";
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[gapsnap] SESSION_SECRET не задан — задайте SESSION_SECRET (>=24 символов) в .env",
    );
  }
  // Deterministic fallback for local/dev; production must set SESSION_SECRET.
  return `gapsnap-derived-v2:${login}:${password}`;
}

export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
