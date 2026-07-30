import {
  getSessionSecret,
  hmacHex,
  timingSafeEqualStr,
} from "@/lib/security/session";
import { getAdminLogin, getAdminPassword } from "@/lib/admin-auth-env";

export const ADMIN_COOKIE = "gs_ops";

/** Filesystem route stays under /trulala; public URL may differ via ADMIN_PATH. */
export const ADMIN_INTERNAL_PATH = "/trulala";

const RESERVED_ADMIN_PATHS = new Set([
  "/",
  "/api",
  "/cabinet",
  "/exchangers",
  "/rates",
  "/blog",
  "/advertise",
  "/apply",
  "/blacklist",
  "/privacy",
  "/cookies",
  "/offer",
  "/partners",
  "/catalogs",
  "/reviews",
]);

/**
 * Public admin URL prefix.
 * Set ADMIN_PATH in .env to a non-obvious path (e.g. /ops-k7m2).
 */
export function normalizeAdminPath(raw: string | undefined | null): string {
  const fallback = ADMIN_INTERNAL_PATH;
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallback;
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const clean = withSlash.replace(/\/+$/, "") || fallback;
  if (!/^\/[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}$/.test(clean)) return fallback;
  if (RESERVED_ADMIN_PATHS.has(clean.toLowerCase())) return fallback;
  return clean;
}

export const ADMIN_PATH = normalizeAdminPath(process.env.ADMIN_PATH);

export function isAdminPublicPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)
  );
}

export function isAdminInternalPath(pathname: string): boolean {
  return (
    pathname === ADMIN_INTERNAL_PATH ||
    pathname.startsWith(`${ADMIN_INTERNAL_PATH}/`)
  );
}

const ADMIN_SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export { getAdminLogin, getAdminPassword };

export function warnIfInsecureAdminConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  const password = getAdminPassword();
  if (password === "admin" || password.length < 10) {
    console.error(
      "[gapsnap] Небезопасный ADMIN_PASSWORD в production (используется для bootstrap owner). Задайте длинный пароль в .env.",
    );
  }
  if (!process.env.SESSION_SECRET?.trim()) {
    console.error(
      "[gapsnap] Задайте SESSION_SECRET (>=24 символов) в .env для подписи сессий.",
    );
  }
  if (ADMIN_PATH === ADMIN_INTERNAL_PATH) {
    console.warn(
      "[gapsnap] ADMIN_PATH не задан — используется /trulala. Задайте свой секретный путь в .env.",
    );
  }
}

async function signAdminPayloadV3(userId: string, exp: number): Promise<string> {
  return hmacHex(getSessionSecret(), `admin-session-v3|${userId}|${exp}`);
}

/** Signed admin session: v3.<userId>.<exp>.<hmac> */
export async function createAdminSessionToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SEC;
  const sig = await signAdminPayloadV3(userId, exp);
  return `v3.${userId}.${exp}.${sig}`;
}

export type ParsedAdminSession = {
  userId: string;
  exp: number;
};

export async function parseAdminSessionToken(
  token: string | null | undefined,
): Promise<ParsedAdminSession | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v3") return null;
  const userId = parts[1] ?? "";
  const exp = Number(parts[2]);
  const sig = parts[3] ?? "";
  if (!userId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  const expected = await signAdminPayloadV3(userId, exp);
  if (!timingSafeEqualStr(sig, expected)) return null;
  return { userId, exp };
}

/** @deprecated env-only check — prefer authenticateAdmin */
export function isValidCredentials(login: string, password: string): boolean {
  return (
    timingSafeEqualStr(login, getAdminLogin()) &&
    timingSafeEqualStr(password, getAdminPassword())
  );
}

export async function isValidAdminSession(
  token: string | null | undefined,
): Promise<boolean> {
  return (await parseAdminSessionToken(token)) !== null;
}

export { timingSafeEqualStr };
