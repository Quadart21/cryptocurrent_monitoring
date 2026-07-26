"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAdmin } from "@/components/admin/AdminProvider";

export function AdminLogin() {
  const { busy, login } = useAdmin();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err = await login(loginValue, password);
    if (err) setError(err);
    else setPassword("");
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="card w-full max-w-sm space-y-4 p-6"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
            Служебный доступ
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            Вход в админку
          </h1>
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            Логин
          </span>
          <input
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
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
        {error && <p className="text-sm text-danger">{error}</p>}
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
