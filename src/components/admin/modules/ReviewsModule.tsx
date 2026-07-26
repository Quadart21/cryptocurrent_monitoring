"use client";

import { useMemo, useState } from "react";
import type { ReviewStatus } from "@/lib/store-types";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  StatusPill,
} from "@/components/admin/ui";

const FILTERS: Array<{ id: "all" | ReviewStatus; label: string }> = [
  { id: "pending", label: "На модерации" },
  { id: "approved", label: "Одобренные" },
  { id: "rejected", label: "Отклонённые" },
  { id: "all", label: "Все" },
];

export function ReviewsModule() {
  const { overview, busy, setBusy, refresh } = useAdmin();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("pending");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    let list = overview?.reviews ?? [];
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (r) =>
          r.exchangerName.toLowerCase().includes(needle) ||
          r.orderId.toLowerCase().includes(needle) ||
          r.text.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [overview, filter, q]);

  async function moderate(id: string, status: "approved" | "rejected") {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("fail");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить отзыв?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const pendingCount =
    overview?.reviews.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Отзывы"
        description="Клиент отправляет отзыв со страницы обменника — здесь можно одобрить или отклонить."
      />

      {pendingCount > 0 && (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 px-5 py-4">
          <p className="font-semibold text-warn">
            Нужно рассмотреть: {pendingCount}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: обменник, заявка, текст"
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
            <p className="px-5 py-6 text-sm text-ink-muted">Нет отзывов</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{r.exchangerName}</p>
                    <StatusPill status={r.status} />
                    <span
                      className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                        r.sentiment === "positive"
                          ? "bg-ok/20 text-ok"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      {r.sentiment === "positive" ? "плюс" : "минус"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    заявка {r.orderId} ·{" "}
                    {new Date(r.createdAt).toLocaleString("ru-RU")}
                  </p>
                  <p className="mt-2 text-sm text-ink">{r.text}</p>
                  {r.qualityLabels.length > 0 && (
                    <p className="mt-2 text-xs text-ink-muted">
                      {r.qualityLabels.join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status !== "approved" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void moderate(r.id, "approved")}
                      className="rounded-xl bg-ok/20 px-3 py-2 text-xs font-semibold text-ok"
                    >
                      Одобрить
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void moderate(r.id, "rejected")}
                      className="rounded-xl bg-warn/20 px-3 py-2 text-xs font-semibold text-warn"
                    >
                      Отклонить
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(r.id)}
                    className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminSection>
    </div>
  );
}
