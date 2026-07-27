"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useOwner } from "@/components/owner/OwnerProvider";

export function OwnerLogin() {
  const { busy, login } = useOwner();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await login(loginValue, password, totpCode || undefined);
    if (result?.needsTotp) {
      setNeedsTotp(true);
      setError(result.error);
      return;
    }
    if (result?.error) {
      setError(result.error);
      return;
    }
    setPassword("");
    setTotpCode("");
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
            Кабинет владельца
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            Вход
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            После одобрения заявки данные для входа и 2FA приходят на email.
          </p>
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
        {(needsTotp || totpCode) && (
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Код 2FA
            </span>
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 цифр"
              maxLength={6}
              required={needsTotp}
              className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Входим…" : needsTotp ? "Подтвердить 2FA" : "Войти"}
        </button>
      </form>
    </div>
  );
}
