"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FeedExchangerStatus } from "@/lib/store-types";
import { formatOutboundCtr } from "@/lib/exchanger-traffic";
import { logoPublicUrl } from "@/lib/logo-url";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminPagination,
  AdminSection,
  StatusPill,
} from "@/components/admin/ui";

const PAGE_SIZE = 30;

const FILTERS: Array<{ id: "all" | FeedExchangerStatus; label: string }> = [
  { id: "all", label: "Все" },
  { id: "pending", label: "На проверке" },
  { id: "active", label: "Активные" },
  { id: "error", label: "Ошибки" },
  { id: "rejected", label: "Отклонённые" },
];

export function ExchangersModule() {
  const { overview } = useAdmin();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    let list = overview?.exchangers ?? [];
    if (filter !== "all") list = list.filter((e) => e.status === filter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(needle) ||
          e.slug.toLowerCase().includes(needle) ||
          e.feedUrl.toLowerCase().includes(needle) ||
          e.contact.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [overview, filter, q]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  useEffect(() => {
    setPage(1);
  }, [filter, q]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Обменники"
        description="Откройте карточку обменника, чтобы править данные, ачивки и смотреть трафик."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: имя, slug, фид, контакт"
          className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent sm:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                filter === f.id
                  ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                  : "border border-line text-ink-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <AdminSection title={`Список (${rows.length})`}>
        <div className="divide-y divide-line">
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Ничего не найдено</p>
          ) : (
            paginatedRows.map((ex) => {
              const logoSrc = logoPublicUrl(ex.id, ex.logo);
              return (
                <Link
                  key={ex.id}
                  href={`${ADMIN_PATH}/exchangers/${encodeURIComponent(ex.id)}`}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-accent-soft/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoSrc}
                        alt=""
                        className="size-11 rounded-2xl bg-bg-soft object-contain"
                      />
                    ) : (
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/20 text-sm font-bold text-accent">
                        {ex.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{ex.name}</p>
                        <StatusPill status={ex.status} />
                        {ex.verified ? <StatusPill status="verified" /> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-muted">
                        {ex.slug} · {ex.pairCount} пар · ★{" "}
                        {ex.reviews === 0
                          ? "нет отзывов"
                          : `${ex.rating.toFixed(2).replace(".", ",")} (${ex.reviews})`}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Просмотры {ex.traffic?.pageViews ?? 0} · Переходы{" "}
                        {ex.traffic?.siteClicks ?? 0} · конверсия{" "}
                        {formatOutboundCtr(
                          ex.traffic ?? { pageViews: 0, siteClicks: 0 },
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-accent sm:shrink-0">
                    Открыть →
                  </span>
                </Link>
              );
            })
          )}
        </div>
        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
        />
      </AdminSection>
    </div>
  );
}
