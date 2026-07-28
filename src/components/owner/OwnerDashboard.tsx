"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  useOwner,
  type OwnerReview,
} from "@/components/owner/OwnerProvider";
import { logoPublicUrl } from "@/lib/logo-url";

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Активен";
    case "pending":
      return "На модерации";
    case "rejected":
      return "Отклонён";
    case "error":
      return "Ошибка фида";
    default:
      return status;
  }
}

function ReviewReplyCard({
  review,
  canReply,
  onSaved,
}: {
  review: OwnerReview;
  canReply: boolean;
  onSaved: () => Promise<boolean>;
}) {
  const [reply, setReply] = useState(review.ownerReply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

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
      await onSaved();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
            review.sentiment === "positive"
              ? "bg-ok/20 text-ok"
              : "bg-danger/15 text-danger"
          }`}
        >
          {review.sentiment === "positive" ? "Положительный" : "Отрицательный"}
        </span>
        <span
          className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
            review.status === "approved"
              ? "bg-ok/15 text-ok"
              : review.status === "rejected"
                ? "bg-danger/15 text-danger"
                : "bg-warn/15 text-warn"
          }`}
        >
          {review.status === "approved"
            ? "Одобрен"
            : review.status === "rejected"
              ? "Отклонён"
              : "На модерации"}
        </span>
        <span className="text-xs text-ink-muted">заявка {review.orderId}</span>
        <span className="text-xs text-ink-muted">
          · {new Date(review.createdAt).toLocaleString("ru-RU")}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-ink">{review.text}</p>

      {review.status === "approved" ? (
        canReply ? (
          <div className="space-y-2 border-t border-line pt-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Ваш ответ
              </span>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Ответ появится на публичной странице обменника"
                className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm outline-none focus:border-accent"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            {ok && <p className="text-sm text-ok">Ответ сохранён</p>}
            <button
              type="button"
              disabled={busy || reply.trim().length < 2}
              onClick={() => void save()}
              className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy
                ? "Сохраняем…"
                : review.ownerReply
                  ? "Обновить ответ"
                  : "Ответить"}
            </button>
          </div>
        ) : review.ownerReply ? (
          <div className="rounded-2xl border border-line bg-bg-soft/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
              Ваш ответ
            </p>
            <p className="mt-1 text-sm text-ink">{review.ownerReply}</p>
          </div>
        ) : null
      ) : null}
    </article>
  );
}

export function OwnerDashboard() {
  const { exchanger, reviews, logout, refresh, busy } = useOwner();
  if (!exchanger) return null;

  const canReply =
    exchanger.status === "active" || exchanger.status === "error";
  const logoSrc = logoPublicUrl(exchanger.id, exchanger.logo);
  const approvedReviews = reviews.filter((r) => r.status === "approved");
  const pendingReviews = reviews.filter((r) => r.status === "pending");

  return (
    <div className="relative z-10 min-h-screen">
      <header className="border-b border-line bg-bg-elevated/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="size-10 rounded-2xl bg-bg-soft object-contain"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/20 text-sm font-bold text-accent">
                {exchanger.name.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                Кабинет владельца
              </p>
              <h1 className="font-display text-lg font-semibold text-ink">
                {exchanger.name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href={`/exchangers/${exchanger.slug}`}
              className="rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted hover:text-accent"
            >
              Публичная страница
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void logout()}
              className="rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted hover:text-danger"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {!canReply && (
          <div className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            {exchanger.status === "pending"
              ? "Заявка ещё на модерации. После одобрения здесь появятся ответы на отзывы и актуальная статистика трафика."
              : exchanger.status === "rejected"
                ? "Заявка отклонена. Редактирование профиля недоступно — свяжитесь с поддержкой мониторинга."
                : "Обменник не в рабочем статусе."}
          </div>
        )}

        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                Профиль
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                После одобрения данные только для просмотра — изменить их нельзя.
              </p>
            </div>
            <span className="rounded-xl bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">
              {statusLabel(exchanger.status)}
            </span>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Сайт", value: exchanger.website },
              { label: "Контакт", value: exchanger.contact },
              { label: "XML-фид", value: exchanger.feedUrl },
              {
                label: "В работе",
                value: exchanger.workingSince || "ещё не одобрен",
              },
              {
                label: "Последняя синхронизация",
                value: exchanger.lastSyncAt
                  ? new Date(exchanger.lastSyncAt).toLocaleString("ru-RU")
                  : "—",
              },
              {
                label: "Описание",
                value: exchanger.description || "—",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-line bg-bg-soft/50 p-3"
              >
                <dt className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  {item.label}
                </dt>
                <dd className="mt-1 break-all text-sm text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
          {exchanger.lastError ? (
            <p className="mt-3 text-sm text-danger">{exchanger.lastError}</p>
          ) : null}
        </section>

        {exchanger.bannerHtml ? (
          <section className="card space-y-4 p-5">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                Баннер GapSnap
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Разместите этот HTML на сайте (например в футере). Раз в сутки
                мы проверяем наличие кнопки. Статус:{" "}
                <strong className="text-ink">{exchanger.bannerStatus}</strong>
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/badge/${exchanger.bannerToken}`}
              alt="GapSnap"
              width={88}
              height={31}
            />
            <pre className="overflow-x-auto rounded-2xl border border-line bg-bg-soft p-3 text-[11px] text-ink">
              {exchanger.bannerHtml}
            </pre>
            <button
              type="button"
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
              onClick={() => {
                void navigator.clipboard.writeText(exchanger.bannerHtml ?? "");
              }}
            >
              Скопировать код
            </button>
          </section>
        ) : null}

        <section className="card p-5">
          <h2 className="font-display text-xl font-semibold text-ink">
            Статистика
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Просмотры карточки и переходы на сайт обменника.
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Просмотры",
                value: String(exchanger.traffic.pageViews),
              },
              {
                label: "Переходы",
                value: String(exchanger.traffic.siteClicks),
              },
              {
                label: "Конверсия",
                value: exchanger.traffic.ctr,
              },
              {
                label: "Рейтинг",
                value:
                  exchanger.reviews === 0
                    ? "нет отзывов"
                    : `★ ${exchanger.rating.toFixed(2).replace(".", ",")} · ${exchanger.reviewsPositive}+ / ${exchanger.reviewsNegative}−`,
              },
              {
                label: "Направлений",
                value: String(exchanger.pairCount),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-line bg-bg-soft/50 p-3"
              >
                <dt className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-ink">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {exchanger.traffic.daily.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-muted">
                    <th className="py-2 pr-3 font-medium">День</th>
                    <th className="py-2 pr-3 font-medium">Просмотры</th>
                    <th className="py-2 font-medium">Переходы</th>
                  </tr>
                </thead>
                <tbody>
                  {exchanger.traffic.daily.map((row) => (
                    <tr key={row.date} className="border-b border-line/60">
                      <td className="py-2 pr-3 tabular-nums text-ink">
                        {row.date}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-ink">
                        {row.pageViews}
                      </td>
                      <td className="py-2 tabular-nums text-ink">
                        {row.siteClicks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Отзывы
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Отвечать можно только на одобренные отзывы
              {pendingReviews.length
                ? ` · на модерации: ${pendingReviews.length}`
                : ""}
              .
            </p>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет отзывов.</p>
          ) : (
            <div className="space-y-3">
              {[...approvedReviews, ...reviews.filter((r) => r.status !== "approved")].map(
                (review) => (
                  <ReviewReplyCard
                    key={review.id}
                    review={review}
                    canReply={canReply}
                    onSaved={refresh}
                  />
                ),
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
