"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ExchangerLogoMark } from "@/components/ExchangerLogoMark";
import type {
  ExchangerLogo,
  ReviewQualityTag,
  ReviewSentiment,
} from "@/lib/store-types";

type ApprovedReview = {
  id: string;
  sentiment: ReviewSentiment;
  orderId: string;
  text: string;
  qualityLabels: string[];
  createdAt: string;
  ownerReply: string | null;
  ownerRepliedAt: string | null;
};

type Props = {
  exchangerId: string;
  exchangerName: string;
  logo?: ExchangerLogo | null;
};

export function ExchangerReviews({
  exchangerId,
  exchangerName,
  logo = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<ReviewQualityTag[]>([]);
  const [reviews, setReviews] = useState<ApprovedReview[]>([]);
  const [sentiment, setSentiment] = useState<ReviewSentiment>("positive");
  const [orderId, setOrderId] = useState("");
  const [text, setText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `/api/reviews?exchangerId=${encodeURIComponent(exchangerId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        reviews: ApprovedReview[];
        tags: ReviewQualityTag[];
      };
      setReviews(data.reviews);
      setTags(data.tags);
    })();
  }, [exchangerId]);

  function toggleTag(id: string) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchangerId,
          sentiment,
          orderId,
          text,
          qualityTagIds: selectedTags,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить отзыв");
        return;
      }
      setMessage(data.message ?? "Отзыв отправлен на модерацию");
      setOrderId("");
      setText("");
      setSelectedTags([]);
      setSentiment("positive");
      setOpen(false);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Отзывы
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Одобренные отзывы о {exchangerName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setError(null);
            }}
            className="btn-primary inline-flex w-fit rounded-2xl px-4 py-2.5 text-sm font-semibold"
          >
            {open ? "Закрыть форму" : "Оставить отзыв"}
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
            {message}
          </p>
        )}

        {open && (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Оценка
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSentiment("positive")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${
                    sentiment === "positive"
                      ? "bg-ok/20 text-ok ring-1 ring-ok/40"
                      : "border border-line text-ink-muted"
                  }`}
                >
                  Положительный
                </button>
                <button
                  type="button"
                  onClick={() => setSentiment("negative")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${
                    sentiment === "negative"
                      ? "bg-danger/15 text-danger ring-1 ring-danger/40"
                      : "border border-line text-ink-muted"
                  }`}
                >
                  Отрицательный
                </button>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Номер заявки в обменнике
              </span>
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
                placeholder="Например, 128473"
                className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Текст отзыва
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                rows={4}
                minLength={10}
                maxLength={2000}
                placeholder="Опишите опыт обмена…"
                className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm outline-none focus:border-accent"
              />
            </label>

            {tags.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                  Качества
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const on = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                          on
                            ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                            : "border border-line text-ink-muted"
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "Отправляем…" : "Отправить на модерацию"}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <p className="text-sm text-ink-muted">Пока нет одобренных отзывов.</p>
        ) : (
          reviews.map((r) => (
            <article key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                    r.sentiment === "positive"
                      ? "bg-ok/20 text-ok"
                      : "bg-danger/15 text-danger"
                  }`}
                >
                  {r.sentiment === "positive" ? "Положительный" : "Отрицательный"}
                </span>
                <span className="text-xs text-ink-muted">
                  заявка {r.orderId}
                </span>
                <span className="text-xs text-ink-muted">
                  · {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink">{r.text}</p>
              {r.qualityLabels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.qualityLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-xl border border-line px-2.5 py-1 text-xs text-ink-muted"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
              {r.ownerReply ? (
                <div className="relative mt-4 overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-soft/80 to-bg-soft/40 pl-1 shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--accent)_18%,transparent)]">
                  <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]" />
                  <div className="px-4 py-3.5 pl-5 sm:px-5 sm:pl-6">
                    <div className="flex items-start gap-3">
                      <ExchangerLogoMark
                        name={exchangerName}
                        exchangerId={exchangerId}
                        logo={logo}
                        size={36}
                        className="shrink-0 ring-1 ring-accent/20"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-display text-sm font-semibold text-ink">
                            {exchangerName}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-deep">
                            <svg
                              viewBox="0 0 16 16"
                              className="size-3"
                              aria-hidden
                            >
                              <path
                                fill="currentColor"
                                d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.03 4.72-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 2.97-2.97a.75.75 0 0 1 1.06 1.06Z"
                              />
                            </svg>
                            Представитель
                          </span>
                          {r.ownerRepliedAt ? (
                            <span className="text-xs text-ink-muted">
                              ·{" "}
                              {new Date(r.ownerRepliedAt).toLocaleDateString(
                                "ru-RU",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          Официальный ответ на отзыв
                        </p>
                        <p className="mt-2.5 text-sm leading-relaxed text-ink">
                          {r.ownerReply}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
