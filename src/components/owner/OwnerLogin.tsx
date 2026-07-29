"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import {
  TurnstileWidget,
  isTurnstileClientEnabled,
  type TurnstileWidgetHandle,
} from "@/components/security/TurnstileWidget";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useOwner } from "@/components/owner/OwnerProvider";

export function OwnerLogin() {
  const { busy, login } = useOwner();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const turnstileRequired = isTurnstileClientEnabled();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (turnstileRequired && !turnstileToken) {
      setError("Пройдите проверку Cloudflare");
      return;
    }

    const result = await login(
      loginValue,
      password,
      totpCode || undefined,
      turnstileToken ?? undefined,
    );

    if (result?.needsTotp) {
      setNeedsTotp(true);
      setError(result.error);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      return;
    }
    if (result?.error) {
      setError(result.error);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      return;
    }
    setPassword("");
    setTotpCode("");
    setTurnstileToken(null);
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -left-24 top-[-10%] size-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.35),transparent_70%)] blur-2xl motion-safe:animate-pulse" />
        <div className="absolute -right-16 bottom-[-5%] size-[24rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.22),transparent_70%)] blur-2xl" />
        <div className="absolute left-1/2 top-1/3 size-[18rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.14),transparent_70%)] blur-3xl" />
      </div>

      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink transition hover:text-accent"
        >
          GapSnap
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-6">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-deep">
              GapSnap · кабинет
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Вход для владельцев
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
              После одобрения заявки логин, пароль и 2FA приходят на email.
            </p>
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="relative overflow-hidden rounded-[1.75rem] border border-line/80 bg-bg-elevated/90 p-6 shadow-[var(--card-shadow)] backdrop-blur-md sm:p-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
            />

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-ink-muted">
                  Логин
                </span>
                <input
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="your_login"
                  className="w-full rounded-2xl border border-line bg-input px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/50 focus:border-accent focus:shadow-[var(--glow)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-ink-muted">
                  Пароль
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-line bg-input px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/50 focus:border-accent focus:shadow-[var(--glow)]"
                />
              </label>

              {(needsTotp || totpCode) && (
                <label className="block space-y-2 animate-rise">
                  <span className="text-xs font-medium text-ink-muted">
                    Код 2FA
                  </span>
                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6 цифр из приложения"
                    maxLength={6}
                    required={needsTotp}
                    className="w-full rounded-2xl border border-line bg-input px-3.5 py-3 text-sm tracking-[0.2em] text-ink outline-none transition placeholder:tracking-normal placeholder:text-ink-muted/50 focus:border-accent focus:shadow-[var(--glow)]"
                  />
                </label>
              )}

              <div className="space-y-2 pt-1">
                <span className="text-xs font-medium text-ink-muted">
                  Защита от ботов
                </span>
                <TurnstileWidget
                  ref={turnstileRef}
                  action="owner-login"
                  onToken={setTurnstileToken}
                  className="rounded-2xl border border-line/70 bg-bg-soft/50 p-3"
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy || (turnstileRequired && !turnstileToken)}
                className="btn-primary w-full rounded-2xl px-4 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? "Входим…"
                  : needsTotp
                    ? "Подтвердить 2FA"
                    : "Войти в кабинет"}
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-ink-muted">
            <Link href="/" className="hover:text-accent">
              На главную
            </Link>
            <span aria-hidden className="text-line">
              ·
            </span>
            <Link href="/apply" className="hover:text-accent">
              Подать заявку
            </Link>
            <span aria-hidden className="text-line">
              ·
            </span>
            <Link href="/partners" className="hover:text-accent">
              Партнёрам
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
