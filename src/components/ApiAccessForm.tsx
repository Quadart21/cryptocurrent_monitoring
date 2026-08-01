"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import {
  TurnstileWidget,
  isTurnstileClientEnabled,
  type TurnstileWidgetHandle,
} from "@/components/security/TurnstileWidget";

type Result = { ok?: boolean; error?: string; message?: string };

export function ApiAccessForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const turnstileRequired = isTurnstileClientEnabled();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);

    if (turnstileRequired && !token) {
      setResult({ error: "Пройдите проверку Cloudflare" });
      setPending(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      website: String(form.get("website") ?? ""),
      purpose: String(form.get("purpose") ?? ""),
      turnstileToken: token ?? "",
    };

    try {
      const res = await fetch("/api/api-access/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Result;
      if (!res.ok) {
        setResult({ error: data.error ?? "Не удалось отправить заявку" });
        turnstileRef.current?.reset();
        setToken(null);
      } else {
        setResult({ ok: true, message: data.message });
        event.currentTarget.reset();
        turnstileRef.current?.reset();
        setToken(null);
      }
    } catch {
      setResult({ error: "Сеть недоступна, попробуйте ещё раз" });
      turnstileRef.current?.reset();
      setToken(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="card space-y-4 p-4 sm:p-6">
        <Field
          label="Имя / проект"
          name="name"
          placeholder="Acme Rates Bot"
          required
        />
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="dev@example.com"
          hint="На этот адрес придёт ключ после одобрения"
          required
        />
        <Field
          label="Сайт / приложение"
          name="website"
          placeholder="https://example.com"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">
            Цель использования API
          </span>
          <textarea
            name="purpose"
            required
            rows={4}
            minLength={10}
            placeholder="Агрегатор курсов для мобильного приложения…"
            className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink outline-none ring-accent/30 focus:ring-2"
          />
        </label>

        {turnstileRequired ? (
          <TurnstileWidget
            ref={turnstileRef}
            action="api-access"
            onToken={setToken}
          />
        ) : null}

        <button
          type="submit"
          disabled={pending || (turnstileRequired && !token)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Отправка…" : "Подать заявку на API-ключ"}
        </button>
      </form>

      {result?.error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {result.error}
        </p>
      ) : null}
      {result?.ok ? (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink outline-none ring-accent/30 focus:ring-2"
      />
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}
