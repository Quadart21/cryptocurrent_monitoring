"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function AdminQrCode({
  value,
  size = 180,
}: {
  value: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="animate-pulse rounded-2xl bg-bg-soft"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="QR-код для 2FA"
      width={size}
      height={size}
      className="rounded-2xl border border-line bg-white p-2"
    />
  );
}

function CopyButton({ text, label = "Копировать" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
      className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-muted hover:text-ink"
    >
      {done ? "Скопировано" : label}
    </button>
  );
}

export type OnboardingStep = {
  title: string;
  detail: string;
  done?: boolean;
};

export function AdminSecurityCard({
  title,
  subtitle,
  steps,
  login,
  tempPassword,
  totpSecret,
  totpUri,
  code,
  onCodeChange,
  onConfirm,
  onLater,
  confirmLabel = "Подтвердить и включить 2FA",
  busy,
  error,
}: {
  title: string;
  subtitle?: string;
  steps: OnboardingStep[];
  login?: string;
  tempPassword?: string | null;
  totpSecret?: string | null;
  totpUri?: string | null;
  code?: string;
  onCodeChange?: (v: string) => void;
  onConfirm?: () => void;
  onLater?: () => void;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-bg-soft/50 px-5 py-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        ) : null}
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-3 rounded-2xl border border-line bg-bg-soft/30 px-3.5 py-3"
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.done
                      ? "bg-ok/20 text-ok"
                      : "bg-accent/15 text-accent"
                  }`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {login || tempPassword ? (
            <div className="rounded-2xl border border-line bg-bg-elevated p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Доступ
              </p>
              {login ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-ink-muted">Логин</p>
                    <p className="font-mono text-sm font-semibold text-ink">
                      {login}
                    </p>
                  </div>
                  <CopyButton text={login} />
                </div>
              ) : null}
              {tempPassword ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <div>
                    <p className="text-xs text-ink-muted">Временный пароль</p>
                    <p className="font-mono text-sm font-semibold text-warn">
                      {tempPassword}
                    </p>
                  </div>
                  <CopyButton text={tempPassword} />
                </div>
              ) : null}
            </div>
          ) : null}

          {totpSecret ? (
            <div className="rounded-2xl border border-line bg-bg-elevated p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Секрет вручную
                </p>
                <CopyButton text={totpSecret} label="Копировать секрет" />
              </div>
              <p className="mt-2 break-all font-mono text-xs text-ink">
                {totpSecret}
              </p>
            </div>
          ) : null}

          {onConfirm && onCodeChange ? (
            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-ink-muted">
                  Код из приложения
                </span>
                <input
                  value={code ?? ""}
                  onChange={(e) => onCodeChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 цифр"
                  className="w-full max-w-xs rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </label>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || (code ?? "").replace(/\s/g, "").length < 6}
                  onClick={onConfirm}
                  className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {confirmLabel}
                </button>
                {onLater ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onLater}
                    className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink"
                  >
                    Позже
                  </button>
                ) : null}
              </div>
            </div>
          ) : onLater ? (
            <button
              type="button"
              disabled={busy}
              onClick={onLater}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink"
            >
              Понятно, закрыть
            </button>
          ) : null}
        </div>

        {totpUri ? (
          <div className="flex flex-col items-center gap-2 justify-self-center">
            <AdminQrCode value={totpUri} />
            <p className="max-w-[180px] text-center text-[11px] text-ink-muted">
              Отсканируйте в Google Authenticator, 1Password, Authy…
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
