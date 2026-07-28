import {
  getSessionSecret,
  hmacHex,
  timingSafeEqualStr,
} from "@/lib/security/session";

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
  "/offer",
  "/partners",
  "/catalogs",
  "/reviews",
]);

/**
 * Public admin URL prefix.
 * Set ADMIN_PATH in .env to a non-obvious path (e.g. /ops-k7m2).
 * Do NOT put this path into robots.txt — that advertises it.
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

export function getAdminLogin(): string {
  return process.env.ADMIN_LOGIN?.trim() || "admin";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "admin";
}

export function warnIfInsecureAdminConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  const password = getAdminPassword();
  if (password === "admin" || password.length < 10) {
    console.error(
      "[gapsnap] Небезопасный ADMIN_PASSWORD в production. Задайте длинный пароль в .env.",
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

async function signAdminPayload(login: string, exp: number): Promise<string> {
  return hmacHex(getSessionSecret(), `admin-session-v2|${login}|${exp}`);
}

/** Signed admin session: v2.<exp>.<hmac> */
export async function createAdminSessionToken(login: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SEC;
  const sig = await signAdminPayload(login, exp);
  return `v2.${exp}.${sig}`;
}

/** @deprecated compatibility alias */
export async function sessionTokenFromCredentials(
  login: string,
  _password: string,
): Promise<string> {
  return createAdminSessionToken(login);
}

export function isValidCredentials(login: string, password: string): boolean {
  return (
    timingSafeEqualStr(login, getAdminLogin()) &&
    timingSafeEqualStr(password, getAdminPassword())
  );
}

export async function isValidAdminSession(
  token: string | null | undefined,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v2") return false;
  const exp = Number(parts[1]);
  const sig = parts[2] ?? "";
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = await signAdminPayload(getAdminLogin(), exp);
  return timingSafeEqualStr(sig, expected);
}

export { timingSafeEqualStr };
