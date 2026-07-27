import "server-only";

import { randomBytes } from "crypto";
import * as OTPAuth from "otpauth";

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotp(secretBase32: string, label: string, issuer: string) {
  return new OTPAuth.TOTP({
    issuer,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function totpAuthUri(
  secretBase32: string,
  label: string,
  issuer = "GapSnap",
): string {
  return buildTotp(secretBase32, label, issuer).toString();
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  window = 1,
): boolean {
  const cleaned = code.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(cleaned)) return false;
  const totp = buildTotp(secretBase32, "owner", "GapSnap");
  const delta = totp.validate({ token: cleaned, window });
  return delta !== null;
}

/** Readable temporary password for email delivery. */
export function generateOwnerTempPassword(): string {
  // 12 chars base64url without ambiguous padding
  return randomBytes(9).toString("base64url");
}
