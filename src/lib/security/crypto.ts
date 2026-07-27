import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";

function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keylen,
      options,
      (err: Error | null, derived: Buffer) => {
        if (err) reject(err);
        else resolve(derived);
      },
    );
  });
}

export function timingSafeEqualBuf(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** scrypt hash: scrypt$n$r$p$salt$hash */
export async function hashPasswordScrypt(password: string): Promise<string> {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(password, salt, 32, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPasswordScrypt(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4]!;
  const expected = parts[5]!;
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  try {
    const derived = await scryptAsync(password, salt, 32, { N, r, p });
    const a = Buffer.from(expected);
    const b = Buffer.from(derived.toString("base64url"));
    return timingSafeEqualBuf(a, b);
  } catch {
    return false;
  }
}

export function isScryptHash(value: string): boolean {
  return value.startsWith("scrypt$");
}
