export const ADMIN_COOKIE = "cm_ops";
export const ADMIN_PATH = "/trulala";

export function getAdminLogin(): string {
  return process.env.ADMIN_LOGIN?.trim() || "admin";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "admin";
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function sessionTokenFromCredentials(
  login: string,
  password: string,
): Promise<string> {
  const data = new TextEncoder().encode(`cryptomon:${login}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedSessionToken(): Promise<string> {
  return sessionTokenFromCredentials(getAdminLogin(), getAdminPassword());
}

export function isValidCredentials(login: string, password: string): boolean {
  return (
    timingSafeEqualStr(login, getAdminLogin()) &&
    timingSafeEqualStr(password, getAdminPassword())
  );
}

export async function isValidAdminSession(
  cookieValue: string | null | undefined,
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await expectedSessionToken();
  return timingSafeEqualStr(cookieValue, expected);
}
