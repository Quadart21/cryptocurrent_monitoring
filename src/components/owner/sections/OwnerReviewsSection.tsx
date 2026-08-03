"use client";

import { useEffect, useMemo, useState } from "react";
import { ReviewsPagination } from "@/components/ReviewsPagination";
import type { OwnerReview } from "@/components/owner/OwnerProvider";
import { canOwnerReply } from "@/components/owner/owner-utils";
import {
  OwnerBadge,
  OwnerEmptyState,
  OwnerSectionCard,
} from "@/components/owner/OwnerUi";

type ReviewFilter = "all" | "need_reply" | "pending" | "positive" | "negative";

const PAGE_SIZE = 10;

function ReviewCard({
  review,
  canReply,
  onSaved,
}: {
  review: OwnerReview;
  canReply: boolean;
  onSaved: () => Promise<boolean>;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const thread = review.replies ?? [];
  const closed = Boolean(review.threadClosed);
  const showReplyForm =
    review.status === "approved" && canReply && !closed;

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/owner/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, reply }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить ответ");
        return;
      }
      setOk(true);
      setReply("");
      await onSaved();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-3xl border border-line bg-bg-elevated p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <OwnerBadge
          tone={review.sentiment === "positive" ? "ok" : "danger"}
        >
          {review.sentiment === "positive" ? "Положительный" : "Отрицательный"}
        </OwnerBadge>
        <OwnerBadge
          tone={
            review.status === "approved"
              ? "ok"
              : review.status === "rejected"
                ? "danger"
                : "warn"
          }
        >
          {review.status === "approved"
            ? "На сайте"
            : review.status === "rejected"
              ? "Отклонён"
              : "На модерации"}
        </OwnerBadge>
        {closed ? <OwnerBadge>Топик закрыт</OwnerBadge> : null}
        <span className="text-xs text-ink-muted">
          {new Date(review.createdAt).toLocaleString("ru-RU")}
        </span>
        <span className="text-xs text-ink-muted">· заявка {review.orderId}</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink">{review.text}</p>

      {thread.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Переписка
          </p>
          {thread.map((msg) => {
            const isYou = msg.authorRole === "owner";
            return (
              <div
                key={msg.id}
                className={`rounded-2xl border px-3 py-2.5 ${
                  isYou
                    ? "border-accent/25 bg-accent/5"
                    : "border-line bg-bg-soft/50"
                }`}
              >
                <p className="text-[11px] font-semibold text-accent-deep">
                  {isYou
                    ? "Вы"
                    : msg.authorRole === "admin"
                      ? "Модератор GapSnap"
                      : "Автор отзыва"}
                  <span className="ml-2 font-normal text-ink-muted">
                    {new Date(msg.createdAt).toLocaleString("ru-RU")}
                  </span>
                </p>
                <p className="mt-1 text-sm text-ink">{msg.body}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {showReplyForm ? (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">
              Ваш ответ клиенту
            </span>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Коротко и по делу — автор получит письмо со ссылкой ответить"
              className="min-h-24 w-full rounded-2xl border border-line bg-input px-3 py-3 text-base outline-none focus:border-accent sm:text-sm"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {ok ? (
            <p className="text-sm text-ok">Ответ отправлен — спасибо!</p>
          ) : null}
          <button
            type="button"
            disabled={busy || reply.trim().length < 2}
            onClick={() => void save()}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Отправляем…" : "Ответить"}
          </button>
        </div>
      ) : review.status === "approved" && closed ? (
        <p className="mt-4 text-xs text-ink-muted">
          Обсуждение закрыто модератором GapSnap.
        </p>
      ) : review.status === "pending" ? (
        <p className="mt-4 text-xs text-ink-muted">
          Отзыв ещё на модерации — ответить можно после публикации.
        </p>
      ) : null}
    </article>
  );
}

function needsOwnerReply(review: OwnerReview): boolean {
  if (review.status !== "approved" || review.threadClosed) return false;
  const thread = review.replies ?? [];
  if (thread.length === 0) return true;
  const last = thread[thread.length - 1];
  return last?.authorRole !== "owner";
}

export function OwnerReviewsSection({
  reviews,
  exchangerStatus,
  onSaved,
}: {
  reviews: OwnerReview[];
  exchangerStatus: string;
  onSaved: () => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [page, setPage] = useState(1);
  const canReply = canOwnerReply(exchangerStatus);

  const filtered = useMemo(() => {
    let list = [...reviews];
    switch (filter) {
      case "need_reply":
        list = list.filter(needsOwnerReply);
        break;
      case "pending":
        list = list.filter((r) => r.status === "pending");
        break;
      case "positive":
        list = list.filter((r) => r.sentiment === "positive");
        break;
      case "negative":
        list = list.filter((r) => r.sentiment === "negative");
        break;
      default:
        break;
    }
    return list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [reviews, filter]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const needReplyCount = reviews.filter(needsOwnerReply).length;

  const filters: Array<{ id: ReviewFilter; label: string }> = [
    { id: "all", label: `Все (${reviews.length})` },
    { id: "need_reply", label: `Ждут ответа (${needReplyCount})` },
    {
      id: "pending",
      label: `Модерация (${reviews.filter((r) => r.status === "pending").length})`,
    },
    { id: "positive", label: "Положительные" },
    { id: "negative", label: "Отрицательные" },
  ];

  return (
    <OwnerSectionCard
      title="Отзывы"
      description="Отвечайте на опубликованные отзывы — это повышает доверие и рейтинг на мониторинге."
    >
      {!canReply ? (
        <p className="mb-4 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Ответы доступны после одобрения обменника.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-accent text-white"
                : "border border-line bg-bg-soft/40 text-ink-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <OwnerEmptyState
          title="Пока тихо"
          description="Когда появятся отзывы, вы сможете ответить здесь. Клиент получит письмо со ссылкой продолжить переписку."
        />
      ) : filtered.length === 0 ? (
        <OwnerEmptyState
          title="Ничего не найдено"
          description="Попробуйте другой фильтр — или вернитесь ко «Всем»."
        />
      ) : (
        <div className="space-y-3">
          {pageItems.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              canReply={canReply}
              onSaved={onSaved}
            />
          ))}
          <ReviewsPagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </OwnerSectionCard>
  );
}
