"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
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
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type TotpReveal = {
  login: string;
  totpSecret: string;
  totpUri: string;
};

export function AdminsModule() {
  const { busy, setBusy, can, me, refresh } = useAdmin();
  const [tab, setTab] = useState<"list" | "create">("list");
  const [users, setUsers] = useState<AdminRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [totpReveal, setTotpReveal] = useState<TotpReveal | null>(null);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("moderator");
  const [displayName, setDisplayName] = useState("");

  const [selfSecret, setSelfSecret] = useState<string | null>(null);
  const [selfUri, setSelfUri] = useState<string | null>(null);
  const [selfCode, setSelfCode] = useState("");

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
    setOk(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, role, displayName }),
      });
      const body = (await res.json()) as {
        error?: string;
        user?: AdminRow;
        totpSecret?: string;
        totpUri?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось создать");
        return;
      }
      setTotpReveal({
        login: body.user?.login ?? login,
        totpSecret: body.totpSecret ?? "",
        totpUri: body.totpUri ?? "",
      });
      setLogin("");
      setPassword("");
      setDisplayName("");
      setTab("list");
      setOk("Админ создан — сохраните секрет 2FA");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(
    id: string,
    patch: Partial<{ role: AdminRole; active: boolean; password: string }>,
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Ошибка");
        return;
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
    if (!confirm("Сбросить 2FA и выдать новый секрет?")) return;
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
      setTotpReveal({
        login: body.user?.login ?? "",
        totpSecret: body.totpSecret ?? "",
        totpUri: body.totpUri ?? "",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function startSelfTotp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const body = (await res.json()) as {
        error?: string;
        totpSecret?: string;
        totpUri?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Ошибка");
        return;
      }
      setSelfSecret(body.totpSecret ?? null);
      setSelfUri(body.totpUri ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSelfTotp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code: selfCode }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Ошибка");
        return;
      }
      setOk("2FA включена");
      setSelfSecret(null);
      setSelfUri(null);
      setSelfCode("");
      await refresh();
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!can("admins.read") && me && !me.totpEnabled) {
    // allow self 2FA setup section only via shell banner → still show setup here if opened
  }

  if (!can("admins.read")) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Админы" description="Недостаточно прав" />
        {!me?.totpEnabled ? (
          <AdminSection title="Включить 2FA для своего аккаунта">
            <div className="space-y-3 p-5">
              {!selfSecret ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startSelfTotp()}
                  className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
                >
                  Сгенерировать секрет
                </button>
              ) : (
                <form
                  onSubmit={(e) => void confirmSelfTotp(e)}
                  className="space-y-3"
                >
                  <p className="text-sm text-ink-muted">
                    Добавьте в Authenticator:
                  </p>
                  <code className="block break-all rounded-xl border border-line bg-bg-soft p-3 text-xs">
                    {selfSecret}
                  </code>
                  {selfUri ? (
                    <p className="break-all text-[11px] text-ink-muted">
                      {selfUri}
                    </p>
                  ) : null}
                  <input
                    value={selfCode}
                    onChange={(e) => setSelfCode(e.target.value)}
                    placeholder="Код из приложения"
                    className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent sm:max-w-xs"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
                  >
                    Подтвердить 2FA
                  </button>
                </form>
              )}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
          </AdminSection>
        ) : (
          <p className="text-sm text-ink-muted">Раздел только для owner.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Админы"
        description="Роли, доступ к разделам и двухфакторная аутентификация."
        actions={
          can("admins.write") ? (
            <button
              type="button"
              onClick={() => setTab("create")}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Добавить
            </button>
          ) : null
        }
      />

      {!me?.totpEnabled ? (
        <AdminSection title="Включите 2FA для своего аккаунта">
          <div className="space-y-3 p-5">
            <p className="text-sm text-ink-muted">
              Bootstrap-owner создаётся без 2FA. Включите её сейчас.
            </p>
            {!selfSecret ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void startSelfTotp()}
                className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                Сгенерировать секрет
              </button>
            ) : (
              <form
                onSubmit={(e) => void confirmSelfTotp(e)}
                className="space-y-3"
              >
                <code className="block break-all rounded-xl border border-line bg-bg-soft p-3 text-xs">
                  {selfSecret}
                </code>
                {selfUri ? (
                  <p className="break-all text-[11px] text-ink-muted">{selfUri}</p>
                ) : null}
                <input
                  value={selfCode}
                  onChange={(e) => setSelfCode(e.target.value)}
                  placeholder="Код из приложения"
                  className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent sm:max-w-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
                >
                  Подтвердить 2FA
                </button>
              </form>
            )}
          </div>
        </AdminSection>
      ) : null}

      {totpReveal ? (
        <AdminSection title={`Секрет 2FA · ${totpReveal.login}`}>
          <div className="space-y-2 p-5">
            <p className="text-sm text-warn">
              Покажите один раз — потом секрет не восстановить без сброса.
            </p>
            <code className="block break-all rounded-xl border border-line bg-bg-soft p-3 text-xs">
              {totpReveal.totpSecret}
            </code>
            <p className="break-all text-[11px] text-ink-muted">
              {totpReveal.totpUri}
            </p>
            <button
              type="button"
              onClick={() => setTotpReveal(null)}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
            >
              Скрыть
            </button>
          </div>
        </AdminSection>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {ok ? <p className="text-sm text-ok">{ok}</p> : null}

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
                <span className="text-xs text-ink-muted">Пароль</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
              <label className="block space-y-1">
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
            <p className="text-xs text-ink-muted">
              После создания сразу включается 2FA — секрет покажем один раз.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Создать
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
                    {u.totpEnabled ? "вкл" : "выкл"}
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
                        const next = window.prompt("Новый пароль (мин. 8)");
                        if (!next) return;
                        void patchUser(u.id, { password: next });
                      }}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold"
                    >
                      Пароль
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
