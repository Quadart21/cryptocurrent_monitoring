import {
  getSessionSecret,
  hmacHex,
  timingSafeEqualStr,
} from "@/lib/security/session";

export const ADMIN_COOKIE = "gs_ops";
export const ADMIN_PATH = "/trulala";
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
