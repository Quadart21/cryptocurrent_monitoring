export const OWNER_COOKIE = "cm_owner";
export const OWNER_PATH = "/cabinet";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashOwnerPassword(password: string): Promise<string> {
  return sha256Hex(`cryptomon-owner-pw:${password}`);
}

export async function ownerSessionToken(input: {
  exchangerId: string;
  ownerLogin: string;
  ownerPasswordHash: string;
}): Promise<string> {
  return sha256Hex(
    `cryptomon-owner-session:${input.exchangerId}:${input.ownerLogin}:${input.ownerPasswordHash}`,
  );
}

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
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const exchangerId = cookieValue.slice(0, dot);
  const token = cookieValue.slice(dot + 1);
  if (!exchangerId || !token) return null;
  return { exchangerId, token };
}

export { timingSafeEqualStr };
