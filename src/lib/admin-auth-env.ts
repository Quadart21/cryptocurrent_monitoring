/** Env helpers split out so admin-users can import without session cycles. */

export function getAdminLogin(): string {
  return process.env.ADMIN_LOGIN?.trim() || "admin";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "admin";
}
