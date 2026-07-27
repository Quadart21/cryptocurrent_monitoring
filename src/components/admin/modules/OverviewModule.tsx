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

      <AdminSection title="Быстрые разделы">
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Обменники", `${ADMIN_PATH}/exchangers`],
            ["Отзывы", `${ADMIN_PATH}/reviews`],
            ["Качества", `${ADMIN_PATH}/qualities`],
            ["Ачивки", `${ADMIN_PATH}/achievements`],
            ["Реклама", `${ADMIN_PATH}/ads`],
            ["SEO", `${ADMIN_PATH}/seo`],
            ["Чёрный список", `${ADMIN_PATH}/blacklist`],
            ["Синхронизация", `${ADMIN_PATH}/sync`],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold hover:border-accent hover:bg-accent-soft"
            >
              {label}
            </Link>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
