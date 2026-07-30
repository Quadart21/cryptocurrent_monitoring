"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAdmin } from "@/components/admin/AdminProvider";

export function AdminLogin() {
  const { busy, login } = useAdmin();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await login(
      loginValue,
      password,
      totpCode || undefined,
    );
    if (result.needsTotp) setNeedsTotp(true);
    if (result.error) setError(result.error);
    else {
      setPassword("");
      setTotpCode("");
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="card w-full max-w-sm space-y-4 p-6 sm:p-7"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            GapSnap
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            Вход в админку
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Служебный доступ к панели управления.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Логин</span>
          <input
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-muted">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        {needsTotp || totpCode ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Код 2FA</span>
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 цифр"
              className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Входим…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
