"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export function ComplaintForm({
  exchangerId,
  exchangerName,
}: {
  exchangerId: string;
  exchangerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [acked, setAcked] = useState(false);
  const [email, setEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchangerId,
          email,
          orderId,
          text,
          acknowledged: acked,
        }),
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось отправить");
        return;
      }
      setMessage(body.message ?? "Проверьте почту");
      setEmail("");
      setOrderId("");
      setText("");
      setAcked(false);
      setOpen(false);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Жалоба на обменник
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Сначала попробуйте решить вопрос через отзывы. Если реакции нет —
            отправьте жалобу модераторам.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-2xl border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
        >
          {open ? "Скрыть форму" : "Пожаловаться"}
        </button>
      </div>

      {message ? <p className="text-sm text-ok">{message}</p> : null}

      {open ? (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-sm text-ink">
            <p className="font-semibold text-[var(--warn)]">Важно</p>
            <p className="mt-1 text-ink-muted">
              Оставьте отзыв на странице «{exchangerName}» и дождитесь ответа
              представителя. Жалобу отправляйте, если реакции нет или ситуация
              требует вмешательства модерации GapSnap.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
              className="mt-1 size-4 accent-[var(--accent)]"
              required
            />
            <span>
              Я пытался(ась) решить вопрос через отзывы / понимаю, что жалоба —
              следующий шаг
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs text-ink-muted">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-ink-muted">ID заявки (опц.)</span>
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-ink-muted">Суть жалобы</span>
            <textarea
              required
              minLength={20}
              maxLength={4000}
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="Опишите проблему и что уже пробовали…"
            />
          </label>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || !acked}
            className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Отправить жалобу
          </button>
        </form>
      ) : null}
    </div>
  );
}
