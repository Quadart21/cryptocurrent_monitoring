"use client";

import Link from "next/link";
import type { OwnerExchanger } from "@/components/owner/OwnerProvider";
import {
  OWNER_SUPPORT_TG,
  OWNER_SUPPORT_TG_URL,
  buildOwnerChecklist,
  statusHint,
  statusLabel,
  statusTone,
  type OwnerTabId,
} from "@/components/owner/owner-utils";
import {
  OwnerBadge,
  OwnerSectionCard,
  OwnerStatCard,
} from "@/components/owner/OwnerUi";

export function OwnerOverviewSection({
  exchanger,
  pendingReviews,
  unansweredReviews,
  onGo,
}: {
  exchanger: OwnerExchanger;
  pendingReviews: number;
  unansweredReviews: number;
  onGo: (tab: OwnerTabId) => void;
}) {
  const checklist = buildOwnerChecklist(exchanger);
  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent/10 via-bg-elevated to-bg-elevated p-5 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
          Добро пожаловать
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Кабинет «{exchanger.name}»
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
          Здесь — статус на мониторинге, баннер для сайта, переходы посетителей и
          ответы на отзывы. Всё в одном месте, без лишнего.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <OwnerBadge tone={statusTone(exchanger.status)}>
            {statusLabel(exchanger.status)}
          </OwnerBadge>
          {exchanger.verified ? (
            <OwnerBadge tone="ok">Проверен</OwnerBadge>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink">
          {statusHint(exchanger.status)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/exchangers/${exchanger.slug}`}
            className="btn-primary inline-flex min-h-11 items-center rounded-2xl px-4 py-2.5 text-sm font-semibold"
          >
            Открыть страницу на GapSnap
          </Link>
          <a
            href={OWNER_SUPPORT_TG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-2xl border border-line bg-bg-elevated px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/40 hover:text-accent"
          >
            Написать @{OWNER_SUPPORT_TG}
          </a>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OwnerStatCard
          label="Просмотры карточки"
          value={String(exchanger.traffic.pageViews)}
          hint="Сколько раз открыли вашу страницу"
        />
        <OwnerStatCard
          label="Переходы на сайт"
          value={String(exchanger.traffic.siteClicks)}
          hint="Клики «Обменять» / «Перейти»"
        />
        <OwnerStatCard
          label="Конверсия"
          value={exchanger.traffic.ctr}
          hint="Доля переходов от просмотров"
        />
        <OwnerStatCard
          label="Рейтинг"
          value={
            exchanger.reviews === 0
              ? "—"
              : `★ ${exchanger.rating.toFixed(1).replace(".", ",")}`
          }
          hint={
            exchanger.reviews === 0
              ? "Пока нет одобренных отзывов"
              : `${exchanger.reviewsPositive} пол. · ${exchanger.reviewsNegative} отр.`
          }
        />
      </div>

      {(pendingReviews > 0 || unansweredReviews > 0 || exchanger.lastError) && (
        <div className="space-y-2">
          {exchanger.lastError ? (
            <button
              type="button"
              onClick={() => onGo("profile")}
              className="w-full rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-left text-sm text-danger transition hover:border-danger/50"
            >
              <strong className="font-semibold">Проблема с фидом.</strong>{" "}
              {exchanger.lastError}
            </button>
          ) : null}
          {unansweredReviews > 0 ? (
            <button
              type="button"
              onClick={() => onGo("reviews")}
              className="w-full rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-left text-sm text-accent-deep transition hover:border-accent/40"
            >
              <strong className="font-semibold">
                Есть отзывы без ответа ({unansweredReviews}).
              </strong>{" "}
              Откройте раздел «Отзывы» и ответьте клиентам.
            </button>
          ) : null}
          {pendingReviews > 0 ? (
            <div className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
              На модерации отзывов: {pendingReviews}. Они появятся на сайте после
              проверки.
            </div>
          ) : null}
        </div>
      )}

      <OwnerSectionCard
        title="Что сделать"
        description={`Готово ${doneCount} из ${checklist.length}. Отмечайте пункты по мере настройки.`}
      >
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={!item.tab}
                onClick={() => item.tab && onGo(item.tab)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                  item.done
                    ? "border-ok/25 bg-ok/5"
                    : "border-line bg-bg-soft/40 hover:border-accent/30"
                } ${item.tab ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    item.done
                      ? "bg-ok text-white"
                      : "border border-line bg-bg-elevated text-ink-muted"
                  }`}
                  aria-hidden
                >
                  {item.done ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {item.hint}
                    {item.tab && !item.done ? " · перейти →" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </OwnerSectionCard>
    </div>
  );
}
