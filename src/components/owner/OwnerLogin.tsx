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

type Mode = "login" | "remind";

export function OwnerLogin() {
  const { busy, login } = useOwner();
  const [mode, setMode] = useState<Mode>("login");
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [remindEmail, setRemindEmail] = useState("");
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindDone, setRemindDone] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const turnstileRequired = isTurnstileClientEnabled();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setRemindDone(null);
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }

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
    }
    turnstileRef.current?.reset();
    setTurnstileToken(null);
    if (!result?.error) {
      setPassword("");
      setTotpCode("");
    }
  }

  async function onRemind(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setRemindDone(null);

    if (turnstileRequired && !turnstileToken) {
      setError("Пройдите проверку Cloudflare");
      return;
    }

    setRemindBusy(true);
    try {
      const res = await fetch("/api/owner/remind-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: remindEmail,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || "Не удалось отправить запрос");
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        return;
      }
      setRemindDone(
        data.message ||
          "Если этот email привязан к обменнику, мы отправили данные для входа.",
      );
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setRemindBusy(false);
    }
  }

  const formBusy = mode === "login" ? busy : remindBusy;

  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-line bg-bg-elevated px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink transition hover:text-accent"
        >
          GapSnap
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-12 pt-8 sm:px-6">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Кабинет владельца
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
              {mode === "login" ? "Вход" : "Доступ по email"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
              {mode === "login"
                ? "После одобрения заявки логин, пароль и 2FA приходят на email."
                : "Укажите email, который указан у обменника — пришлём логин и временный пароль."}
            </p>
          </div>

          {mode === "login" ? (
            <form
              onSubmit={(e) => void onSubmit(e)}
              className="card space-y-4 p-4 sm:p-7"
            >
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-ink-muted">Логин</span>
                <input
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="your_login"
                  className="min-h-12 w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-base outline-none focus:border-accent sm:text-sm"
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
                  placeholder="••••••••"
                  className="min-h-12 w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-base outline-none focus:border-accent sm:text-sm"
                />
              </label>

              {needsTotp || totpCode ? (
                <label className="block space-y-1.5 animate-rise">
                  <span className="text-xs font-medium text-ink-muted">
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
                    className="min-h-12 w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-base tracking-[0.2em] outline-none focus:border-accent sm:text-sm"
                  />
                </label>
              ) : null}

              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-medium text-ink-muted">
                  Защита от ботов
                </span>
                <TurnstileWidget
                  ref={turnstileRef}
                  action="owner-login"
                  onToken={setTurnstileToken}
                  className="rounded-xl border border-line bg-bg-soft/50 p-3"
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
                disabled={formBusy || (turnstileRequired && !turnstileToken)}
                className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? "Входим…"
                  : needsTotp
                    ? "Подтвердить 2FA"
                    : "Войти в кабинет"}
              </button>

              <button
                type="button"
                onClick={() => switchMode("remind")}
                className="w-full rounded-xl border border-line bg-bg-soft/40 px-4 py-3 text-sm font-medium text-ink transition hover:border-accent/40 hover:text-accent"
              >
                Вы владелец обменника? Получить доступ
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => void onRemind(e)}
              className="card space-y-4 p-4 sm:p-7"
            >
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-ink-muted">
                  Email обменника
                </span>
                <input
                  type="email"
                  value={remindEmail}
                  onChange={(e) => {
                    setRemindEmail(e.target.value);
                    setRemindDone(null);
                  }}
                  autoComplete="email"
                  required
                  placeholder="owner@exchange.com"
                  className="min-h-12 w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-base outline-none focus:border-accent sm:text-sm"
                />
              </label>

              <p className="text-xs leading-relaxed text-ink-muted">
                Если обменник добавили вручную или вы забыли пароль — укажите
                email из карточки обменника. Мы вышлем логин и временный пароль.
              </p>

              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-medium text-ink-muted">
                  Защита от ботов
                </span>
                <TurnstileWidget
                  ref={turnstileRef}
                  action="owner-remind"
                  onToken={setTurnstileToken}
                  className="rounded-xl border border-line bg-bg-soft/50 p-3"
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

              {remindDone ? (
                <p
                  role="status"
                  className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-ink"
                >
                  {remindDone}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={formBusy || (turnstileRequired && !turnstileToken)}
                className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {remindBusy ? "Отправляем…" : "Выслать доступ на email"}
              </button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full rounded-xl border border-line bg-bg-soft/40 px-4 py-3 text-sm font-medium text-ink transition hover:border-accent/40 hover:text-accent"
              >
                Вернуться ко входу
              </button>
            </form>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-ink-muted">
            <Link href="/" className="hover:text-ink">
              На главную
            </Link>
            <span aria-hidden>·</span>
            <Link href="/apply" className="hover:text-ink">
              Подать заявку
            </Link>
            <span aria-hidden>·</span>
            <Link href="/partners" className="hover:text-ink">
              Партнёрам
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
