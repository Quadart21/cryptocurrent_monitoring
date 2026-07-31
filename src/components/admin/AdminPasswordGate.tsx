"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";

export function AdminPasswordGate() {
  const { busy, setBusy, refresh, me } = useAdmin();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Пароль не короче 8 символов");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          newPassword: password,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="card w-full max-w-md space-y-5 p-6 sm:p-8"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Первый вход
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            Смените временный пароль
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Аккаунт <strong className="text-ink">{me?.login}</strong> создан с
            одноразовым паролем. Придумайте свой — дальше без этого шага не
            пустим в панель.
          </p>
        </div>

        <ol className="space-y-2 rounded-2xl border border-line bg-bg-soft/40 p-4 text-sm">
          <li className="flex gap-2">
            <span className="font-semibold text-accent">1.</span>
            <span className="text-ink-muted">Задайте новый пароль (мин. 8)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-accent">2.</span>
            <span className="text-ink-muted">
              Затем предложим включить 2FA (можно позже)
            </span>
          </li>
        </ol>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Новый пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Ещё раз</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Сохраняем…" : "Сохранить и продолжить"}
        </button>
      </form>
    </div>
  );
}
