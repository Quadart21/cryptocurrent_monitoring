"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";

type ApplyResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  exchanger?: { slug: string; name: string; pairCount: number };
};

export function ApplyForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      website: String(form.get("website") ?? ""),
      feedUrl: String(form.get("feedUrl") ?? ""),
      contact: String(form.get("contact") ?? ""),
      description: String(form.get("description") ?? ""),
    };

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ApplyResult;
      if (!res.ok) setResult({ error: data.error ?? "Не удалось отправить заявку" });
      else {
        setResult(data);
        event.currentTarget.reset();
      }
    } catch {
      setResult({ error: "Сеть недоступна, попробуйте ещё раз" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="card space-y-5 p-6">
        <Field label="Название обменника" name="name" placeholder="Kubex" required />
        <Field label="Сайт" name="website" placeholder="https://example.com" required />
        <Field
          label="URL XML-фида (valuta.xml)"
          name="feedUrl"
          placeholder="https://example.com/exports/valuta.xml"
          hint="Формат BestChange: <rates><item><from/><to/><in/><out/><amount/>…"
          required
        />
        <Field label="Контакт" name="contact" placeholder="email@ или @telegram" required />
        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            Краткое описание
          </span>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Специализация, регионы, особенности"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
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
}: {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}
