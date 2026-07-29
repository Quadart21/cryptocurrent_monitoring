"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { FieldHint } from "@/components/ui/FieldHint";

type ApplyResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  exchanger?: { slug: string; name: string; pairCount: number };
};

export function ApplyForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);

    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as ApplyResult;
      if (!res.ok) setResult({ error: data.error ?? "Не удалось отправить заявку" });
      else {
        setResult(data);
        formEl.reset();
        setLogoName(null);
      }
    } catch {
      setResult({ error: "Сеть недоступна, попробуйте ещё раз" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="card space-y-5 p-4 sm:p-6" encType="multipart/form-data">
        <Field label="Название обменника" name="name" placeholder="Kubex" required />
        <Field label="Сайт" name="website" placeholder="https://example.com" required />
        <Field
          label="Ссылка на обмен по паре"
          name="exchangeUrlTemplate"
          placeholder="https://example.com/exchange/{0}/{1}"
          hint="{0} — код валюты «отдаёте», {1} — «получаете» (например BTC, USDTTRC20, SBP). При клике «Обменять» откроется направление, выбранное на мониторинге."
          required
        />
        <Field
          label="URL XML-фида"
          name="feedUrl"
          placeholder="https://example.com/exports/rates.xml"
          hint="Публичный XML со списком курсов: корневой тег rates, внутри item с полями from, to, in, out, amount (резерв). Опционально — minamount/maxamount или frommin/frommax (лимиты)."
          required
        />
        <Field label="Контакт" name="contact" placeholder="email@ или @telegram" required />
        <Field
          label="Email владельца"
          name="ownerEmail"
          type="email"
          placeholder="owner@example.com"
          hint="На этот адрес после одобрения придут доступ в кабинет и 2FA"
          required
          autoComplete="email"
        />

        <div className="rounded-2xl border border-line bg-bg-soft/40 p-4 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Кабинет владельца
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Логин задаёте сейчас. После одобрения на email придут временный
              пароль и секрет 2FA для входа на{" "}
              <Link href="/cabinet" className="text-accent underline underline-offset-2">
                /cabinet
              </Link>
              .
            </p>
          </div>
          <Field
            label="Логин"
            name="ownerLogin"
            placeholder="my_exchanger"
            hint="3–32 символа: латиница, цифры, _"
            required
            autoComplete="username"
          />
          <Field
            label="Пароль"
            name="ownerPassword"
            type="password"
            placeholder="минимум 8 символов"
            minLength={8}
            required
            autoComplete="new-password"
          />
          <Field
            label="Повтор пароля"
            name="ownerPasswordConfirm"
            type="password"
            required
            autoComplete="new-password"
          />
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            Краткое описание
          </span>
          <textarea
            name="description"
            rows={3}
            className="min-h-24 w-full rounded-2xl border border-line bg-input px-3 py-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
            placeholder="Специализация, регионы, особенности"
          />
        </label>

        <label className="block space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            Логотип
            <FieldHint text="Только SVG или PNG с прозрачным фоном, до 512 КБ. После одобрения логотип появится в списке и на странице обменника." />
          </span>
          <input
            type="file"
            name="logo"
            accept=".svg,.png,image/svg+xml,image/png"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setLogoName(file?.name ?? null);
            }}
            className="block w-full text-sm text-ink file:mr-3 file:rounded-xl file:border-0 file:bg-accent/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-accent"
          />
          {logoName ? (
            <span className="block text-xs text-ink">Выбрано: {logoName}</span>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Проверяем XML-фид…" : "Отправить заявку"}
        </button>
      </form>

      {result?.error && (
        <p className="mt-4 rounded-2xl border border-danger/30 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-danger">
          {result.error}
        </p>
      )}

      {result?.ok && result.exchanger && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-4 text-sm text-accent-deep">
          <p className="font-semibold">{result.message}</p>
          <p className="mt-2">
            Страница:{" "}
            <Link
              href={`/exchangers/${result.exchanger.slug}`}
              className="underline underline-offset-2"
            >
              {result.exchanger.name}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  hint,
  required,
  type = "text",
  autoComplete,
  minLength,
}: {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
        {label}
        {hint ? <FieldHint text={hint} /> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="min-h-12 w-full rounded-2xl border border-line bg-input px-3 py-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
      />
    </label>
  );
}
