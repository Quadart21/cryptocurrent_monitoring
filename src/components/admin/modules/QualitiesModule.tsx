"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection, StatusPill } from "@/components/admin/ui";

export function QualitiesModule() {
  const { overview, busy, setBusy, refresh } = useAdmin();
  const [label, setLabel] = useState("");

  async function addTag(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/qualities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("fail");
      setLabel("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: { active?: boolean; label?: string }) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/qualities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) throw new Error("fail");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить качество из списка?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/qualities?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const tags = overview?.qualityTags ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Качества"
        description="Предустановки для формы отзыва на странице обменника (быстрый, круглосуточный и т.д.)."
      />

      <AdminSection title="Добавить качество">
        <form
          onSubmit={(e) => void addTag(e)}
          className="grid gap-3 p-5 sm:grid-cols-[1fr_auto]"
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Например: Быстрый"
            required
            minLength={2}
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

      <AdminSection title={`Список (${tags.length})`}>
        <div className="divide-y divide-line">
          {tags.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Пока пусто</p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">{tag.label}</p>
                  <div className="mt-1">
                    <StatusPill status={tag.active ? "active" : "hidden"} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patch(tag.id, { active: !tag.active })
                    }
                    className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                  >
                    {tag.active ? "Скрыть" : "Показать"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(tag.id)}
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
