"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Complaint, ComplaintStatus } from "@/lib/store-types";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminDrawer,
  AdminPageHeader,
  AdminPagination,
  AdminSection,
} from "@/components/admin/ui";

const PAGE_SIZE = 20;

const FILTERS: Array<{
  id: ComplaintStatus | "open" | "all";
  label: string;
}> = [
  { id: "open", label: "Открытые" },
  { id: "pending", label: "Новые" },
  { id: "in_progress", label: "В работе" },
  { id: "resolved_blacklist", label: "В ЧС" },
  { id: "rejected", label: "Отклонённые" },
  { id: "all", label: "Все" },
];

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  awaiting_email: "ждёт email",
  pending: "новая",
  in_progress: "в работе",
  resolved_blacklist: "в ЧС",
  rejected: "отклонена",
};

export function ComplaintsModule() {
  const { busy, setBusy, refresh } = useAdmin();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [rows, setRows] = useState<Complaint[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs =
        filter === "all"
          ? "?status=all"
          : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/admin/complaints${qs}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        complaints?: Complaint[];
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось загрузить");
        return;
      }
      const list = body.complaints ?? [];
      setRows(list);
      setNotes((prev) => {
        const next = { ...prev };
        for (const c of list) {
          if (next[c.id] === undefined) next[c.id] = c.adminNote;
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }, [filter, setBusy]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const drawerComplaint = useMemo(
    () => (drawerId ? rows.find((c) => c.id === drawerId) : undefined),
    [rows, drawerId],
  );

  const pendingCount = useMemo(
    () => rows.filter((c) => c.status === "pending").length,
    [rows],
  );

  async function patch(
    id: string,
    status?: ComplaintStatus,
    adminNote?: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/complaints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(body.error ?? "Ошибка");
        return;
      }
      await load();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить жалобу?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/complaints?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (drawerId === id) setDrawerId(null);
      await load();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Жалобы"
        description="Очередь жалоб на обменники. В ЧС — только после вашего решения."
      />

      {pendingCount > 0 && filter === "open" ? (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 px-5 py-4">
          <p className="font-semibold text-warn">Новых: {pendingCount}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

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

      <AdminSection title={`Список (${rows.length})`}>
        <div className="divide-y divide-line">
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Нет жалоб</p>
          ) : (
            paginatedRows.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{c.exchangerName}</p>
                    <span className="rounded-xl bg-warn/20 px-2.5 py-1 text-xs font-semibold text-warn">
                      {STATUS_LABEL[c.status]}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {new Date(c.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {c.email}
                    {c.orderId ? ` · заявка ${c.orderId}` : ""}
                    {c.relatedReviewId ? ` · отзыв ${c.relatedReviewId}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink">
                    {c.body}
                  </p>
                  {c.adminNote ? (
                    <p className="mt-1 text-xs text-ink-muted">
                      Заметка: {c.adminNote}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerId(c.id)}
                  className="shrink-0 rounded-xl border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
                >
                  Обработать
                </button>
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
        open={!!drawerComplaint}
        onClose={() => setDrawerId(null)}
        title={drawerComplaint?.exchangerName ?? "Жалоба"}
        description={
          drawerComplaint
            ? `${STATUS_LABEL[drawerComplaint.status]} · ${new Date(drawerComplaint.createdAt).toLocaleString("ru-RU")}`
            : undefined
        }
      >
        {drawerComplaint ? (
          <div className="space-y-4">
            <div className="text-sm text-ink-muted">
              <p>{drawerComplaint.email}</p>
              {drawerComplaint.orderId ? (
                <p className="mt-1">Заявка: {drawerComplaint.orderId}</p>
              ) : null}
              {drawerComplaint.relatedReviewId ? (
                <p className="mt-1">
                  Отзыв: {drawerComplaint.relatedReviewId}
                </p>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink">
              {drawerComplaint.body}
            </p>
            <textarea
              value={notes[drawerComplaint.id] ?? ""}
              onChange={(e) =>
                setNotes((prev) => ({
                  ...prev,
                  [drawerComplaint.id]: e.target.value,
                }))
              }
              rows={3}
              placeholder="Заметка модератора"
              className="w-full rounded-xl border border-line bg-input px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void patch(
                    drawerComplaint.id,
                    undefined,
                    notes[drawerComplaint.id] ?? "",
                  )
                }
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
              >
                Сохранить заметку
              </button>
              {drawerComplaint.status !== "in_progress" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void patch(drawerComplaint.id, "in_progress")}
                  className="rounded-xl bg-warn/20 px-3 py-2 text-xs font-semibold text-warn"
                >
                  В работу
                </button>
              ) : null}
              {drawerComplaint.status !== "rejected" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void patch(drawerComplaint.id, "rejected")}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                >
                  Отклонить
                </button>
              ) : null}
              {drawerComplaint.status !== "resolved_blacklist" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !confirm(
                        `Добавить «${drawerComplaint.exchangerName}» в чёрный список и закрыть жалобу?`,
                      )
                    ) {
                      return;
                    }
                    void patch(drawerComplaint.id, "resolved_blacklist");
                  }}
                  className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                >
                  В ЧС
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(drawerComplaint.id)}
                className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}
      </AdminDrawer>
    </div>
  );
}
