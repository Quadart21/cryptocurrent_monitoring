"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReviewStatus } from "@/lib/store-types";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminDrawer,
  AdminPageHeader,
  AdminPagination,
  AdminSection,
  StatusPill,
} from "@/components/admin/ui";

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [replies, setReplies] = useState<
    Array<{ id: string; authorRole: string; body: string; createdAt: string }>
  >([]);
  const [adminReply, setAdminReply] = useState("");

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

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const threadReview = useMemo(
    () => (threadId ? rows.find((r) => r.id === threadId) : undefined),
    [rows, threadId],
  );

  useEffect(() => {
    setPage(1);
  }, [filter, q]);

  async function moderate(id: string, status: "approved" | "rejected") {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mailWarning?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "fail");
      await refresh();
      if (data.mailWarning) {
        window.alert(data.mailWarning);
      }
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
      if (threadId === id) {
        setDrawerOpen(false);
        setThreadId(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadThread(reviewId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/reviews/thread?reviewId=${encodeURIComponent(reviewId)}`,
      );
      const body = (await res.json()) as {
        replies?: Array<{
          id: string;
          authorRole: string;
          body: string;
          createdAt: string;
        }>;
      };
      setThreadId(reviewId);
      setReplies(body.replies ?? []);
      setAdminReply("");
      setDrawerOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setThreadId(null);
    setReplies([]);
    setAdminReply("");
  }

  async function postAdminReply(reviewId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reviews/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, reply: adminReply }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(body.error ?? "Ошибка");
        return;
      }
      await loadThread(reviewId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleClose(reviewId: string, close: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reviews/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          action: close ? "close" : "open",
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        window.alert(body.error ?? "Ошибка");
        return;
      }
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
        description="Модерация, ответы в треде и закрытие обсуждения."
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
            paginatedRows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 px-5 py-3 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{r.exchangerName}</p>
                    <StatusPill status={r.status} />
                    {r.threadClosed ? (
                      <span className="rounded-xl bg-ink-muted/15 px-2.5 py-1 text-xs font-semibold text-ink-muted">
                        Топик закрыт
                      </span>
                    ) : null}
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
                  <p className="mt-1 line-clamp-2 text-sm text-ink">{r.text}</p>
                  {r.qualityLabels.length > 0 && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {r.qualityLabels.join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 lg:shrink-0">
                  {r.status !== "approved" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void moderate(r.id, "approved")}
                      className="rounded-xl bg-ok/20 px-2.5 py-1.5 text-xs font-semibold text-ok"
                    >
                      Одобрить
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void moderate(r.id, "rejected")}
                      className="rounded-xl bg-warn/20 px-2.5 py-1.5 text-xs font-semibold text-warn"
                    >
                      Отклонить
                    </button>
                  )}
                  {r.status === "approved" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void loadThread(r.id)}
                      className="rounded-xl border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted"
                    >
                      Тред
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(r.id)}
                    className="rounded-xl bg-danger/15 px-2.5 py-1.5 text-xs font-semibold text-danger"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
        />
      </AdminSection>

      <AdminDrawer
        open={drawerOpen && !!threadReview}
        onClose={closeDrawer}
        title={threadReview ? `Тред · ${threadReview.exchangerName}` : "Тред"}
        description={
          threadReview
            ? `заявка ${threadReview.orderId}`
            : undefined
        }
        widthClassName="max-w-xl"
      >
        {threadReview ? (
          <div className="space-y-4">
            <p className="text-sm text-ink">{threadReview.text}</p>

            <div className="space-y-2">
              {replies.length === 0 ? (
                <p className="text-xs text-ink-muted">Пока пусто</p>
              ) : (
                replies.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-line bg-bg-soft/40 px-3 py-2"
                  >
                    <p className="text-[11px] font-semibold text-accent-deep">
                      {msg.authorRole === "owner"
                        ? "Обменник"
                        : msg.authorRole === "admin"
                          ? "Модератор"
                          : "Автор"}
                      <span className="ml-2 font-normal text-ink-muted">
                        {new Date(msg.createdAt).toLocaleString("ru-RU")}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-ink">{msg.body}</p>
                  </div>
                ))
              )}
            </div>

            {!threadReview.threadClosed ? (
              <div className="space-y-2">
                <textarea
                  value={adminReply}
                  onChange={(e) => setAdminReply(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ответ модератора (уйдёт автору на email)"
                  className="w-full rounded-xl border border-line bg-input px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <button
                  type="button"
                  disabled={busy || adminReply.trim().length < 2}
                  onClick={() => void postAdminReply(threadReview.id)}
                  className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  Ответить как модератор
                </button>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">
                Топик закрыт — ответы отключены
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void toggleClose(threadReview.id, !threadReview.threadClosed)
                }
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
              >
                {threadReview.threadClosed ? "Открыть топик" : "Закрыть топик"}
              </button>
            </div>
          </div>
        ) : null}
      </AdminDrawer>
    </div>
  );
}
