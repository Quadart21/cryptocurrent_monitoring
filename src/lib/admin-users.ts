import "server-only";

import { randomBytes } from "crypto";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { adminUsers } from "@/db/schema";
import {
  getAdminLogin,
  getAdminPassword,
} from "@/lib/admin-auth-env";
import {
  ADMIN_ROLES,
  isAdminRole,
  permissionsForRole,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-rbac";
import {
  hashPasswordScrypt,
  verifyPasswordScrypt,
} from "@/lib/security/crypto";
import {
  generateOwnerTempPassword,
  generateTotpSecret,
  totpAuthUri,
  verifyTotpCode,
} from "@/lib/totp";

export type AdminUserPublic = {
  id: string;
  login: string;
  role: AdminRole;
  active: boolean;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AdminUserRow = AdminUserPublic & {
  passwordHash: string;
  totpSecret: string | null;
};

function mapUser(row: typeof adminUsers.$inferSelect): AdminUserRow {
  const role = isAdminRole(row.role) ? row.role : "viewer";
  return {
    id: row.id,
    login: row.login,
    role,
    active: Boolean(row.active),
    totpEnabled: Boolean(row.totpEnabled),
    mustChangePassword: Boolean(row.mustChangePassword),
    totpSecret: row.totpSecret ?? null,
    passwordHash: row.passwordHash,
    displayName: row.displayName ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  };
}

export function toPublicAdmin(user: AdminUserRow): AdminUserPublic {
  const { passwordHash: _p, totpSecret: _t, ...rest } = user;
  return rest;
}

export function adminMePayload(user: AdminUserRow): AdminUserPublic & {
  permissions: AdminPermission[];
} {
  return {
    ...toPublicAdmin(user),
    permissions: permissionsForRole(user.role),
  };
}

let bootstrapPromise: Promise<void> | null = null;

export async function ensureBootstrapAdmin(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const db = getDb();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUsers);
    if (Number(count) > 0) return;

    const login = getAdminLogin().trim().toLowerCase();
    const password = getAdminPassword();
    const now = new Date().toISOString();
    const passwordHash = await hashPasswordScrypt(password);
    await db.insert(adminUsers).values({
      id: `adm_${randomBytes(6).toString("hex")}`,
      login,
      passwordHash,
      role: "owner",
      active: true,
      totpSecret: null,
      totpEnabled: false,
      mustChangePassword: false,
      displayName: "Owner",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    console.info(
      `[gapsnap] Создан bootstrap-админ «${login}» (owner). Включите 2FA в разделе «Админы».`,
    );
  })().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}

export async function listAdminUsers(): Promise<AdminUserPublic[]> {
  await ensureBootstrapAdmin();
  const db = getDb();
  const rows = await db
    .select()
    .from(adminUsers)
    .orderBy(asc(adminUsers.createdAt));
  return rows.map((r) => toPublicAdmin(mapUser(r)));
}

export async function getAdminUserById(
  id: string,
): Promise<AdminUserRow | null> {
  await ensureBootstrapAdmin();
  const db = getDb();
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  return row ? mapUser(row) : null;
}

export async function getAdminUserByLogin(
  login: string,
): Promise<AdminUserRow | null> {
  await ensureBootstrapAdmin();
  const db = getDb();
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.login, login.trim().toLowerCase()))
    .limit(1);
  return row ? mapUser(row) : null;
}

export async function authenticateAdmin(input: {
  login: string;
  password: string;
  totpCode?: string;
}): Promise<
  | { ok: true; user: AdminUserRow }
  | { ok: false; error: string; needsTotp?: boolean }
> {
  const user = await getAdminUserByLogin(input.login);
  if (!user || !user.active) {
    return { ok: false, error: "Неверный логин или пароль" };
  }
  const passOk = await verifyPasswordScrypt(input.password, user.passwordHash);
  if (!passOk) {
    return { ok: false, error: "Неверный логин или пароль" };
  }

  if (user.totpEnabled && user.totpSecret) {
    const code = (input.totpCode ?? "").trim();
    if (!code) {
      return {
        ok: false,
        error: "Введите код 2FA",
        needsTotp: true,
      };
    }
    if (!verifyTotpCode(user.totpSecret, code)) {
      return { ok: false, error: "Неверный код 2FA", needsTotp: true };
    }
  }

  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(adminUsers)
    .set({ lastLoginAt: now })
    .where(eq(adminUsers.id, user.id));

  return { ok: true, user: { ...user, lastLoginAt: now } };
}

export async function createAdminUser(input: {
  login: string;
  role: AdminRole;
  displayName?: string;
}): Promise<
  | {
      user: AdminUserPublic;
      tempPassword: string;
      totpSecret: string;
      totpUri: string;
    }
  | { error: string }
> {
  await ensureBootstrapAdmin();
  const login = input.login.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(login)) {
    return { error: "Логин: 3–32 символа, a-z 0-9 _" };
  }
  if (!ADMIN_ROLES.includes(input.role)) {
    return { error: "Неизвестная роль" };
  }
  if (await getAdminUserByLogin(login)) {
    return { error: "Такой логин уже есть" };
  }

  const tempPassword = generateOwnerTempPassword();
  const totpSecret = generateTotpSecret();
  const now = new Date().toISOString();
  const id = `adm_${randomBytes(6).toString("hex")}`;
  const passwordHash = await hashPasswordScrypt(tempPassword);
  const db = getDb();
  const [row] = await db
    .insert(adminUsers)
    .values({
      id,
      login,
      passwordHash,
      role: input.role,
      active: true,
      totpSecret,
      totpEnabled: false,
      mustChangePassword: true,
      displayName: (input.displayName ?? "").trim(),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    })
    .returning();

  const user = mapUser(row);
  return {
    user: toPublicAdmin(user),
    tempPassword,
    totpSecret,
    totpUri: totpAuthUri(totpSecret, login, "GapSnap Admin"),
  };
}

export async function updateAdminUser(
  id: string,
  patch: {
    role?: AdminRole;
    active?: boolean;
    displayName?: string;
    /** If set, regenerates a temp password and forces change on next login */
    resetPassword?: boolean;
  },
  actorId: string,
): Promise<
  | { user: AdminUserPublic; tempPassword?: string }
  | { error: string }
> {
  await ensureBootstrapAdmin();
  const current = await getAdminUserById(id);
  if (!current) return { error: "Не найден" };

  if (patch.active === false && current.role === "owner") {
    const owners = (await listAdminUsers()).filter(
      (u) => u.role === "owner" && u.active && u.id !== id,
    );
    if (owners.length === 0) {
      return { error: "Нельзя отключить последнего owner" };
    }
  }

  if (patch.role && patch.role !== "owner" && current.role === "owner") {
    const owners = (await listAdminUsers()).filter(
      (u) => u.role === "owner" && u.active && u.id !== id,
    );
    if (owners.length === 0) {
      return { error: "Нельзя снять роль с последнего owner" };
    }
  }

  if (patch.role && !ADMIN_ROLES.includes(patch.role)) {
    return { error: "Неизвестная роль" };
  }

  if (id === actorId && patch.active === false) {
    return { error: "Нельзя отключить самого себя" };
  }

  let tempPassword: string | undefined;
  let nextPassword: string | undefined;
  if (patch.resetPassword) {
    tempPassword = generateOwnerTempPassword();
    nextPassword = await hashPasswordScrypt(tempPassword);
  }

  const db = getDb();
  const [row] = await db
    .update(adminUsers)
    .set({
      ...(patch.role ? { role: patch.role } : {}),
      ...(typeof patch.active === "boolean" ? { active: patch.active } : {}),
      ...(patch.displayName !== undefined
        ? { displayName: patch.displayName.trim() }
        : {}),
      ...(nextPassword
        ? { passwordHash: nextPassword, mustChangePassword: true }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(adminUsers.id, id))
    .returning();

  if (!row) return { error: "Не найден" };
  return { user: toPublicAdmin(mapUser(row)), tempPassword };
}

export async function changeOwnPassword(
  userId: string,
  input: { currentPassword?: string; newPassword: string },
): Promise<{ ok: true } | { error: string }> {
  const user = await getAdminUserById(userId);
  if (!user) return { error: "Не найден" };
  const next = input.newPassword;
  if (next.length < 8) return { error: "Пароль не короче 8 символов" };

  if (!user.mustChangePassword) {
    const current = input.currentPassword ?? "";
    const ok = await verifyPasswordScrypt(current, user.passwordHash);
    if (!ok) return { error: "Текущий пароль неверный" };
  }

  const db = getDb();
  await db
    .update(adminUsers)
    .set({
      passwordHash: await hashPasswordScrypt(next),
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(adminUsers.id, userId));
  return { ok: true };
}

export async function deleteAdminUser(
  id: string,
  actorId: string,
): Promise<{ ok: true } | { error: string }> {
  if (id === actorId) return { error: "Нельзя удалить самого себя" };
  const current = await getAdminUserById(id);
  if (!current) return { error: "Не найден" };
  if (current.role === "owner") {
    const owners = (await listAdminUsers()).filter(
      (u) => u.role === "owner" && u.active && u.id !== id,
    );
    if (owners.length === 0) {
      return { error: "Нельзя удалить последнего owner" };
    }
  }
  const db = getDb();
  await db.delete(adminUsers).where(eq(adminUsers.id, id));
  return { ok: true };
}

export async function resetAdminTotp(id: string): Promise<
  | { totpSecret: string; totpUri: string; user: AdminUserPublic }
  | { error: string }
> {
  const current = await getAdminUserById(id);
  if (!current) return { error: "Не найден" };
  const totpSecret = generateTotpSecret();
  const db = getDb();
  const [row] = await db
    .update(adminUsers)
    .set({
      totpSecret,
      totpEnabled: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(adminUsers.id, id))
    .returning();
  if (!row) return { error: "Не найден" };
  return {
    totpSecret,
    totpUri: totpAuthUri(totpSecret, current.login, "GapSnap Admin"),
    user: toPublicAdmin(mapUser(row)),
  };
}

/** Start or resume pending 2FA setup (secret may already exist). */
export async function enableSelfTotp(
  userId: string,
): Promise<
  | { totpSecret: string; totpUri: string; user: AdminUserPublic }
  | { error: string }
> {
  const current = await getAdminUserById(userId);
  if (!current) return { error: "Не найден" };
  if (current.totpEnabled && current.totpSecret) {
    return { error: "2FA уже включена — попросите owner сбросить" };
  }

  let totpSecret = current.totpSecret;
  if (!totpSecret) {
    totpSecret = generateTotpSecret();
    const db = getDb();
    const [row] = await db
      .update(adminUsers)
      .set({
        totpSecret,
        totpEnabled: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(adminUsers.id, userId))
      .returning();
    if (!row) return { error: "Не найден" };
    return {
      totpSecret,
      totpUri: totpAuthUri(totpSecret, current.login, "GapSnap Admin"),
      user: toPublicAdmin(mapUser(row)),
    };
  }

  return {
    totpSecret,
    totpUri: totpAuthUri(totpSecret, current.login, "GapSnap Admin"),
    user: toPublicAdmin(current),
  };
}

export async function confirmSelfTotp(
  userId: string,
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const current = await getAdminUserById(userId);
  if (!current?.totpSecret) return { error: "Сначала получите секрет 2FA" };
  if (!verifyTotpCode(current.totpSecret, code)) {
    return { error: "Неверный код — проверьте приложение" };
  }
  const db = getDb();
  await db
    .update(adminUsers)
    .set({
      totpEnabled: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(adminUsers.id, userId));
  return { ok: true };
}
