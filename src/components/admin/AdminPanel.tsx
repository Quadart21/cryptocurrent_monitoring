"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { BlacklistItem, FeedExchanger } from "@/lib/store-types";

type Overview = {
  lastGlobalSyncAt: string | null;
  counts: {
    exchangers: number;
    active: number;
    pending: number;
    error: number;
    rates: number;
    blacklist: number;
  };
  exchangers: FeedExchanger[];
  blacklist: BlacklistItem[];
};

export function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [blName, setBlName] = useState("");
  const [blReason, setBlReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setData(null);
      return false;
    }
    if (!res.ok) {
      setAuthed(false);
      setData(null);
      return false;
    }
    setData((await res.json()) as Overview);
    setAuthed(true);
    return true;
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
      setChecking(false);
    })();
  }, [load]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLoginError(body.error ?? "Неверный логин или пароль");
        return;
      }
      setPassword("");
      const ok = await load();
      if (!ok) setLoginError("Сессия не сохранилась, попробуйте ещё раз");
    } catch {
      setLoginError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function patchExchanger(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/exchangers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error("fail");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeExchanger(id: string) {
    if (!confirm("Удалить обменник и его курсы?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/exchangers?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("fail");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    setBusy(true);
    try {
      await fetch("/api/admin/sync", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setData(null);
    setLogin("");
    setPassword("");
  }

  async function addBlacklist(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: blName, reason: blReason }),
      });
      if (!res.ok) throw new Error("fail");
      setBlName("");
      setBlReason("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeBlacklist(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/blacklist?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Загрузка…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <form
          onSubmit={(e) => void onLogin(e)}
          className="card w-full max-w-sm space-y-4 p-6"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              private ops
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
              Вход
            </h1>
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Логин
            </span>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Пароль
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
          {loginError && (
            <p className="text-sm text-danger">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
            private ops
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Cryptomon Admin
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Синк:{" "}
            {data.lastGlobalSyncAt
              ? new Date(data.lastGlobalSyncAt).toLocaleString("ru-RU")
              : "ещё не было"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSync()}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Sync feeds
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-2xl border border-line px-4 py-2.5 text-sm text-ink-muted hover:text-ink"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Всего", data.counts.exchangers],
          ["Active", data.counts.active],
          ["Pending", data.counts.pending],
          ["Error", data.counts.error],
          ["Курсов", data.counts.rates],
          ["ЧС", data.counts.blacklist],
        ].map(([label, value]) => (
          <div key={String(label)} className="card px-4 py-3">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="card mb-8 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-semibold">Обменники</h2>
          <p className="text-sm text-ink-muted">
            Заявки со статуса pending → active появляются в мониторинге
          </p>
        </div>
        <div className="divide-y divide-line">
          {data.exchangers.map((ex) => (
            <div
              key={ex.id}
              className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {ex.name}{" "}
                  <span className="text-xs font-normal text-ink-muted">
                    · {ex.status}
                    {ex.verified ? " · verified" : ""}
                  </span>
                </p>
                <p className="mt-1 truncate text-xs text-ink-muted">
                  {ex.feedUrl}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {ex.contact} · {ex.pairCount} пар
                  {ex.lastError ? ` · ${ex.lastError}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ex.status !== "active" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patchExchanger(ex.id, {
                        status: "active",
                        sync: true,
                      })
                    }
                    className="rounded-xl bg-ok/20 px-3 py-2 text-xs font-semibold text-ok"
                  >
                    Approve
                  </button>
                )}
                {ex.status !== "rejected" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patchExchanger(ex.id, { status: "rejected" })
                    }
                    className="rounded-xl bg-warn/20 px-3 py-2 text-xs font-semibold text-warn"
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patchExchanger(ex.id, { verified: !ex.verified })
                  }
                  className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                >
                  {ex.verified ? "Unverify" : "Verify"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeExchanger(ex.id)}
                  className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-semibold">Чёрный список</h2>
        </div>
        <form
          onSubmit={(e) => void addBlacklist(e)}
          className="grid gap-3 border-b border-line p-5 sm:grid-cols-[1fr_2fr_auto]"
        >
          <input
            value={blName}
            onChange={(e) => setBlName(e.target.value)}
            placeholder="Название"
            required
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            value={blReason}
            onChange={(e) => setBlReason(e.target.value)}
            placeholder="Причина"
            required
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold"
          >
            Добавить
          </button>
        </form>
        <div className="divide-y divide-line">
          {data.blacklist.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-ink-muted">{item.reason}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeBlacklist(item.id)}
                className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
