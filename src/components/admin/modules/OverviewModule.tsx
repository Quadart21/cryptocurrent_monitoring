"use client";

import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection, AdminStatGrid } from "@/components/admin/ui";

export function OverviewModule() {
  const { overview, counts, lastGlobalSyncAt, busy, setBusy, refresh } =
    useAdmin();

  async function runSync() {
    setBusy(true);
    try {
      await fetch("/api/admin/sync", { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!overview || !counts) return null;

  const pendingEx = overview.exchangers.filter((e) => e.status === "pending");
  const pendingRv = overview.reviews.filter((r) => r.status === "pending");
  const bannerMissing = overview.exchangers.filter(
    (e) =>
      e.status === "active" &&
      (e.bannerCheck?.status === "missing" || e.bannerCheck?.status === "error"),
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Обзор"
        description="Сводка по мониторингу и задачам на модерацию."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSync()}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Синхронизировать фиды
          </button>
        }
      />

      <AdminStatGrid
        items={[
          { label: "Обменники", value: counts.exchangers },
          { label: "Активные", value: counts.active, tone: "ok" },
          {
            label: "На проверке",
            value: counts.pending,
            tone: counts.pending ? "warn" : undefined,
          },
          {
            label: "Отзывы ждут",
            value: counts.pendingReviews,
            tone: counts.pendingReviews ? "warn" : undefined,
          },
          {
            label: "Без баннера",
            value: counts.bannerMissing ?? 0,
            tone: counts.bannerMissing ? "warn" : undefined,
          },
          { label: "Курсов", value: counts.rates },
          { label: "Ошибки", value: counts.error },
          { label: "Чёрный список", value: counts.blacklist },
          {
            label: "Последняя синхронизация",
            value: lastGlobalSyncAt
              ? new Date(lastGlobalSyncAt).toLocaleTimeString("ru-RU")
              : "—",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection
          title="Очередь обменников"
          description="Заявки, которые ещё не появились в публичном мониторинге"
        >
          <div className="divide-y divide-line">
            {pendingEx.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">Пусто</p>
            ) : (
              pendingEx.slice(0, 5).map((ex) => (
                <div key={ex.id} className="px-5 py-4">
                  <p className="font-semibold">{ex.name}</p>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {ex.feedUrl}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-line px-5 py-3">
            <Link
              href={`${ADMIN_PATH}/exchangers`}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Открыть модуль обменников →
            </Link>
          </div>
        </AdminSection>

        <AdminSection
          title="Очередь отзывов"
          description="Новые отзывы ждут одобрения или отклонения"
        >
          <div className="divide-y divide-line">
            {pendingRv.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">Пусто</p>
            ) : (
              pendingRv.slice(0, 5).map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <p className="font-semibold">
                    {r.exchangerName}{" "}
                    <span
                      className={
                        r.sentiment === "positive" ? "text-ok" : "text-danger"
                      }
                    >
                      · {r.sentiment === "positive" ? "плюс" : "минус"}
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                    {r.text}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-line px-5 py-3">
            <Link
              href={`${ADMIN_PATH}/reviews`}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Открыть модуль отзывов →
            </Link>
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Баннер GapSnap не найден"
        description="Активные обменники без нашей кнопки на сайте (суточная проверка)"
      >
        <div className="divide-y divide-line">
          {bannerMissing.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Все на месте</p>
          ) : (
            bannerMissing.slice(0, 8).map((ex) => (
              <div
                key={ex.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-semibold">{ex.name}</p>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {ex.website}
                    {ex.bannerCheck?.lastError
                      ? ` · ${ex.bannerCheck.lastError}`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`${ADMIN_PATH}/exchangers/${encodeURIComponent(ex.id)}`}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Карточка →
                </Link>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-line px-5 py-3">
          <Link
            href={`${ADMIN_PATH}/sync`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Проверить баннеры сейчас →
          </Link>
        </div>
      </AdminSection>

      <AdminSection title="Разделы по группам">
        <div className="space-y-5 p-5">
          {[
            {
              label: "Модерация",
              links: [
                ["Обменники", `${ADMIN_PATH}/exchangers`],
                ["Отзывы", `${ADMIN_PATH}/reviews`],
                ["Чёрный список", `${ADMIN_PATH}/blacklist`],
              ],
            },
            {
              label: "Контент",
              links: [
                ["Новости", `${ADMIN_PATH}/blog`],
                ["Качества", `${ADMIN_PATH}/qualities`],
                ["Ачивки", `${ADMIN_PATH}/achievements`],
              ],
            },
            {
              label: "Реклама",
              links: [
                ["Креативы", `${ADMIN_PATH}/ads`],
                ["Тарифы", `${ADMIN_PATH}/ad-tariffs`],
              ],
            },
            {
              label: "Сайт",
              links: [
                ["SEO", `${ADMIN_PATH}/seo`],
                ["Правовые", `${ADMIN_PATH}/legal`],
                ["Email", `${ADMIN_PATH}/email`],
              ],
            },
            {
              label: "Данные",
              links: [
                ["Каталог", `${ADMIN_PATH}/catalog`],
                ["Синхронизация", `${ADMIN_PATH}/sync`],
              ],
            },
          ].map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {group.label}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent hover:bg-accent-soft"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
