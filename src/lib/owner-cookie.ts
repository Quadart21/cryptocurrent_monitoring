/** Edge-safe owner cookie helpers (no Node crypto / server-only). */

export const OWNER_COOKIE = "gs_owner";
export const OWNER_PATH = "/cabinet";

export function encodeOwnerCookie(
  exchangerId: string,
  token: string,
): string {
  return `${exchangerId}.${token}`;
}

export function parseOwnerCookie(
  cookieValue: string | null | undefined,
): { exchangerId: string; token: string } | null {
  if (!cookieValue) return null;
  const match = cookieValue.match(/^([^.]+)\.(v2\.\d+\.[a-f0-9]+)$/i);
  if (match) {
    return { exchangerId: match[1]!, token: match[2]! };
  }
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const exchangerId = cookieValue.slice(0, dot);
  const token = cookieValue.slice(dot + 1);
  if (!exchangerId || !token) return null;
  return { exchangerId, token };
}

export function isOwnerSessionExpired(token: string): boolean {
  const parts = token.split(".");
  if (parts[0] !== "v2") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp)) return true;
  return exp < Math.floor(Date.now() / 1000);
}
