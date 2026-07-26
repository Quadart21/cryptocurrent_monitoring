"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection } from "@/components/admin/ui";

export function BlacklistModule() {
  const { overview, busy, setBusy, refresh } = useAdmin();
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, reason }),
      });
      if (!res.ok) throw new Error("fail");
      setName("");
      setReason("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/blacklist?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const needle = q.trim().toLowerCase();
  const rows = (overview?.blacklist ?? []).filter((item) => {
    if (!needle) return true;
    return (
      item.name.toLowerCase().includes(needle) ||
      item.reason.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Чёрный список"
        description="Публичный список проблемных обменников и причин."
      />

      <AdminSection title="Добавить запись">
        <form
          onSubmit={(e) => void addItem(e)}
          className="grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto]"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название"
            required
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина"
            required
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold"
          >
            Добавить
          </button>
        </form>
      </AdminSection>

      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию или причине"
          className="mb-4 w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent sm:max-w-md"
        />
      </div>

      <AdminSection title={`Список (${rows.length})`}>
        <div className="divide-y divide-line">
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Пусто</p>
          ) : (
            rows.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{item.reason}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.reportedAt} · жалоб: {item.reports}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(item.id)}
                  className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                >
                  Удалить
                </button>
              </div>
            ))
          )}
        </div>
      </AdminSection>
    </div>
  );
}
