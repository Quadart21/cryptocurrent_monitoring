import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, parseAdminSessionToken } from "@/lib/admin-auth";
import {
  permissionForRequest,
  roleHasPermission,
  type AdminPermission,
  type AdminResource,
  type AdminRole,
} from "@/lib/admin-rbac";
import {
  adminMePayload,
  ensureBootstrapAdmin,
  getAdminUserById,
  type AdminUserRow,
} from "@/lib/admin-users";
import { runMigrations } from "@/db/migrate";

export type AdminSessionContext = {
  user: AdminUserRow;
  role: AdminRole;
  permissions: AdminPermission[];
};

export async function getAdminSession(): Promise<AdminSessionContext | null> {
  await runMigrations();
  await ensureBootstrapAdmin();
  const jar = await cookies();
  const parsed = await parseAdminSessionToken(jar.get(ADMIN_COOKIE)?.value);
  if (!parsed) return null;
  const user = await getAdminUserById(parsed.userId);
  if (!user || !user.active) return null;
  return {
    user,
    role: user.role,
    permissions: adminMePayload(user).permissions,
  };
}

/**
 * @param permission — required permission(s). Omit to only require a valid session.
 */
export async function assertAdmin(
  permission?: AdminPermission | AdminPermission[],
): Promise<NextResponse | null> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!permission) return null;

  const needed = Array.isArray(permission) ? permission : [permission];
  const ok = needed.some((p) => roleHasPermission(session.role, p));
  if (!ok) {
    return NextResponse.json(
      { error: "Недостаточно прав", code: "forbidden" },
      { status: 403 },
    );
  }
  return null;
}

/** Map HTTP method → read/write permission for a resource. */
export async function assertAdminResource(
  resource: AdminResource,
  method: string,
): Promise<NextResponse | null> {
  return assertAdmin(permissionForRequest(resource, method));
}

export async function requireAdminSession(
  permission?: AdminPermission | AdminPermission[],
): Promise<AdminSessionContext | NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (permission) {
    const needed = Array.isArray(permission) ? permission : [permission];
    const ok = needed.some((p) => roleHasPermission(session.role, p));
    if (!ok) {
      return NextResponse.json(
        { error: "Недостаточно прав", code: "forbidden" },
        { status: 403 },
      );
    }
  }
  return session;
}

export function isSessionContext(
  value: AdminSessionContext | NextResponse,
): value is AdminSessionContext {
  return !(value instanceof NextResponse) && "user" in value;
}
