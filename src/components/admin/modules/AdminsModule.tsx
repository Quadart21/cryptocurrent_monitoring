"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminSecurityCard } from "@/components/admin/AdminSecurityCard";
import {
  AdminPageHeader,
  AdminSection,
  AdminTabBar,
} from "@/components/admin/ui";
import {
  ADMIN_ROLE_HINT,
  ADMIN_ROLE_LABEL,
  ADMIN_ROLES,
  type AdminRole,
} from "@/lib/admin-rbac";

type AdminRow = {
  id: string;
  login: string;
  role: AdminRole;
  active: boolean;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type Handoff = {
  login: string;
  tempPassword: string;
  totpSecret: string;
  totpUri: string;
};

export function AdminsModule() {
  const { busy, setBusy, can, me, refresh } = useAdmin();
  const [tab, setTab] = useState<"list" | "create">("list");
  const [users, setUsers] = useState<AdminRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  const [login, setLogin] = useState("");
  const [role, setRole] = useState<AdminRole>("moderator");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    if (!can("admins.read")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", { cache: "no-store" });
      const body = (await res.json()) as { users?: AdminRow[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Нет доступа");
        return;
      }
      setUsers(body.users ?? []);
    } finally {
      setBusy(false);
    }
  }, [can, setBusy]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!can("admins.write")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, role, displayName }),
      });
      const body = (await res.json()) as {
        error?: string;
        user?: AdminRow;
        tempPassword?: string;
        totpSecret?: string;
        totpUri?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось создать");
        return;
      }
      setHandoff({
        login: body.user?.login ?? login,
        tempPassword: body.tempPassword ?? "",
        totpSecret: body.totpSecret ?? "",
        totpUri: body.totpUri ?? "",
      });
      setLogin("");
      setDisplayName("");
      setTab("list");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(
    id: string,
    patch: Partial<{ role: AdminRole; active: boolean; resetPassword: boolean }>,
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const body = (await res.json()) as {
        error?: string;
        user?: AdminRow;
        tempPassword?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Ошибка");
        return;
      }
      if (body.tempPassword && body.user) {
        setHandoff({
          login: body.user.login,
          tempPassword: body.tempPassword,
          totpSecret: "",
          totpUri: "",
        });
      }
      await load();
      if (id === me?.id) await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Удалить администратора?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/admins?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Ошибка");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetTotp(id: string) {
    if (!confirm("Сбросить 2FA и выдать новый QR?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_totp", id }),
      });
      const body = (await res.json()) as {
        error?: string;
        totpSecret?: string;
        totpUri?: string;
        user?: AdminRow;
      };
      if (!res.ok) {
        setError(body.error ?? "Ошибка");
        return;
      }
      setHandoff({
        login: body.user?.login ?? "",
        tempPassword: "",
        totpSecret: body.totpSecret ?? "",
        totpUri: body.totpUri ?? "",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!can("admins.read")) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Админы"
          description="Недостаточно прав для управления учётными записями."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Админы"
        description="Роли, временные пароли и двухфакторная аутентификация."
        actions={
          can("admins.write") ? (
            <button
              type="button"
              onClick={() => {
                setHandoff(null);
                setTab("create");
              }}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Добавить
            </button>
          ) : null
        }
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {handoff ? (
        <AdminSecurityCard
          title={
            handoff.tempPassword
              ? "Передайте доступ новому админу"
              : `Новый QR · ${handoff.login}`
          }
          subtitle={
            handoff.tempPassword
              ? "Покажите карточку один раз. Временный пароль сменится при первом входе."
              : "Отсканируйте QR и подтвердите код при следующем входе в аккаунт."
          }
          steps={
            handoff.tempPassword
              ? [
                  {
                    title: "Отправьте логин и временный пароль",
                    detail: "Безопасным каналом — не в общий чат.",
                  },
                  {
                    title: "Первый вход → смена пароля",
                    detail: "Система сама попросит задать постоянный пароль.",
                  },
                  {
                    title: "Подключить 2FA по QR",
                    detail: "Можно отсканировать сейчас или настроить после входа (кнопка «Позже»).",
                  },
                ]
              : [
                  {
                    title: "Отсканируйте новый QR",
                    detail: "Старый код в приложении перестанет работать.",
                  },
                  {
                    title: "Подтвердите код при входе",
                    detail: "Пользователь включит 2FA, введя 6 цифр из приложения.",
                  },
                ]
          }
          login={handoff.login}
          tempPassword={handoff.tempPassword || null}
          totpSecret={handoff.totpSecret || null}
          totpUri={handoff.totpUri || null}
          onLater={() => setHandoff(null)}
        />
      ) : null}

      <AdminTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "list", label: "Список" },
          ...(can("admins.write")
            ? [{ id: "create" as const, label: "Создать" }]
            : []),
        ]}
      />

      {tab === "create" && can("admins.write") ? (
        <AdminSection title="Новый администратор">
          <form onSubmit={(e) => void onCreate(e)} className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs text-ink-muted">Логин</span>
                <input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                  pattern="[a-zA-Z0-9_]{3,32}"
                  className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink-muted">Имя</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs text-ink-muted">Роль</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AdminRole)}
                  className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ADMIN_ROLE_LABEL[r]} — {ADMIN_ROLE_HINT[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="rounded-xl border border-line bg-bg-soft/40 px-3 py-2.5 text-xs text-ink-muted">
              Пароль сгенерируется автоматически. После создания увидите карточку
              с временным паролем и QR для 2FA.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Создать и показать доступ
            </button>
          </form>
        </AdminSection>
      ) : null}

      {tab === "list" ? (
        <AdminSection title={`Учётки (${users.length})`}>
          <div className="divide-y divide-line">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {u.login}
                    {u.displayName ? (
                      <span className="ml-2 font-normal text-ink-muted">
                        · {u.displayName}
                      </span>
                    ) : null}
                    {u.id === me?.id ? (
                      <span className="ml-2 text-xs text-accent">вы</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {ADMIN_ROLE_LABEL[u.role]} ·{" "}
                    {u.active ? "активен" : "отключён"} · 2FA{" "}
                    {u.totpEnabled ? "вкл" : "ожидает"}
                    {u.mustChangePassword ? " · ждёт смены пароля" : ""}
                    {u.lastLoginAt
                      ? ` · вход ${new Date(u.lastLoginAt).toLocaleString("ru-RU")}`
                      : ""}
                  </p>
                </div>
                {can("admins.write") ? (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) =>
                        void patchUser(u.id, {
                          role: e.target.value as AdminRole,
                        })
                      }
                      className="rounded-xl border border-line bg-input px-2 py-1.5 text-xs"
                    >
                      {ADMIN_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ADMIN_ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void patchUser(u.id, { active: !u.active })
                      }
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold"
                    >
                      {u.active ? "Отключить" : "Включить"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resetTotp(u.id)}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold"
                    >
                      Сброс 2FA
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !confirm(
                            "Выдать новый временный пароль? Пользователь сменит его при входе.",
                          )
                        ) {
                          return;
                        }
                        void patchUser(u.id, { resetPassword: true });
                      }}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold"
                    >
                      Новый пароль
                    </button>
                    <button
                      type="button"
                      disabled={busy || u.id === me?.id}
                      onClick={() => void removeUser(u.id)}
                      className="rounded-xl bg-danger/15 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-40"
                    >
                      Удалить
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </AdminSection>
      ) : null}
    </div>
  );
}
