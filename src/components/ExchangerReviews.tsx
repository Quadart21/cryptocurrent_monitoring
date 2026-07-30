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
  threadClosed?: boolean;
  replies?: Array<{
    id: string;
    authorRole: string;
    body: string;
    createdAt: string;
  }>;
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
  const [email, setEmail] = useState("");
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
          email,
          text,
          qualityTagIds: selectedTags,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить отзыв");
        return;
      }
      setMessage(data.message ?? "Отзыв отправлен");
      setOrderId("");
      setEmail("");
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
                className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-base outline-none focus:border-accent sm:text-sm"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Email для подтверждения
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-base outline-none focus:border-accent sm:text-sm"
              />
              <span className="block text-xs text-ink-muted">
                На этот адрес придёт ссылка. Без подтверждения отзыв не попадёт на
                модерацию.
              </span>
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
                className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-base outline-none focus:border-accent sm:text-sm"
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
              {(() => {
                const thread =
                  r.replies && r.replies.length > 0
                    ? r.replies
                    : r.ownerReply
                      ? [
                          {
                            id: `${r.id}-legacy`,
                            authorRole: "owner",
                            body: r.ownerReply,
                            createdAt: r.ownerRepliedAt ?? r.createdAt,
                          },
                        ]
                      : [];
                if (!thread.length && !r.threadClosed) return null;
                return (
                  <div className="mt-4 space-y-2">
                    {thread.map((msg) => {
                      const isOwner = msg.authorRole === "owner";
                      const isAdmin = msg.authorRole === "admin";
                      const label = isAdmin
                        ? "Модератор GapSnap"
                        : isOwner
                          ? "Представитель"
                          : "Автор отзыва";
                      return (
                        <div
                          key={msg.id}
                          className={`relative overflow-hidden rounded-2xl border pl-1 ${
                            isOwner || isAdmin
                              ? "border-accent/25 bg-gradient-to-br from-accent-soft/80 to-bg-soft/40"
                              : "border-line bg-bg-soft/40"
                          }`}
                        >
                          {(isOwner || isAdmin) && (
                            <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]" />
                          )}
                          <div className="px-4 py-3 pl-5">
                            <div className="flex flex-wrap items-center gap-2">
                              {isOwner ? (
                                <ExchangerLogoMark
                                  name={exchangerName}
                                  exchangerId={exchangerId}
                                  logo={logo}
                                  size={28}
                                  className="shrink-0 ring-1 ring-accent/20"
                                />
                              ) : null}
                              <p className="text-xs font-semibold text-accent-deep">
                                {isOwner ? exchangerName : label}
                              </p>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                                {label}
                              </span>
                              <span className="text-xs text-ink-muted">
                                ·{" "}
                                {new Date(msg.createdAt).toLocaleDateString(
                                  "ru-RU",
                                )}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-ink">
                              {msg.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {r.threadClosed ? (
                      <p className="text-xs font-medium text-ink-muted">
                        Обсуждение закрыто модератором
                      </p>
                    ) : null}
                  </div>
                );
              })()}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
