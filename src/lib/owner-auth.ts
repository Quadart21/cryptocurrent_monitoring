import {
  hashPasswordScrypt,
  isScryptHash,
  verifyPasswordScrypt,
} from "@/lib/security/crypto";
import {
  getSessionSecret,
  hmacHex,
  timingSafeEqualStr,
} from "@/lib/security/session";

export {
  OWNER_COOKIE,
  OWNER_PATH,
  encodeOwnerCookie,
  parseOwnerCookie,
  isOwnerSessionExpired,
} from "@/lib/owner-cookie";

const OWNER_SESSION_TTL_SEC = 60 * 60 * 24 * 14; // 14 days

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashOwnerPassword(password: string): Promise<string> {
  return hashPasswordScrypt(password);
}

export async function verifyOwnerPassword(
  password: string,
  storedHash: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (isScryptHash(storedHash)) {
    const ok = await verifyPasswordScrypt(password, storedHash);
    return { ok, needsRehash: false };
  }

  const legacy = await sha256Hex(`gapsnap-owner-pw:${password}`);
  const legacyOldBrand = await sha256Hex(`cryptomon-owner-pw:${password}`);
  const ok =
    timingSafeEqualStr(legacy, storedHash) ||
    timingSafeEqualStr(legacyOldBrand, storedHash);
  return { ok, needsRehash: ok };
}

export async function ownerSessionToken(input: {
  exchangerId: string;
  ownerLogin: string;
  ownerPasswordHash: string;
  exp?: number;
}): Promise<string> {
  const exp =
    input.exp ?? Math.floor(Date.now() / 1000) + OWNER_SESSION_TTL_SEC;
  const sig = await hmacHex(
    getSessionSecret(),
    `owner-session-v2|${input.exchangerId}|${input.ownerLogin}|${input.ownerPasswordHash}|${exp}`,
  );
  return `v2.${exp}.${sig}`;
}

export { timingSafeEqualStr };
