"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection } from "@/components/admin/ui";

const EXAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.3 7L12 16.8 5.7 21 8 14 2 9.2h7.6L12 2z"/></svg>`;

export function AchievementsModule() {
  const { overview, busy, setBusy, refresh } = useAdmin();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = overview?.achievements ?? [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/achievements", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? { id: editingId, name, description, svg }
            : { name, description, svg },
        ),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить");
        return;
      }
      setName("");
      setDescription("");
      setSvg("");
      setEditingId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: string) {
    const item = items.find((a) => a.id === id);
    if (!item) return;
    setEditingId(id);
    setName(item.name);
    setDescription(item.description);
    setSvg(item.svg);
    setError(null);
  }

  async function remove(id: string) {
    if (!confirm("Удалить ачивку? Она снимется со всех обменников.")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/achievements?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (editingId === id) {
        setEditingId(null);
        setName("");
        setDescription("");
        setSvg("");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ачивки"
        description="Создайте иконку (SVG), название и описание. Потом включите ачивку у обменника в разделе «Обменники» — иконка появится рядом с именем."
      />

      <AdminSection
        title={editingId ? "Редактировать ачивку" : "Новая ачивка"}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Название
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Топ мониторинг"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Описание (tooltip)
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
                placeholder="Проверенный обменник с высоким рейтингом"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              SVG иконка
            </span>
            <textarea
              value={svg}
              onChange={(e) => setSvg(e.target.value)}
              required
              rows={5}
              placeholder={EXAMPLE_SVG}
              className="w-full rounded-2xl border border-line bg-input px-3 py-3 font-mono text-xs outline-none focus:border-accent"
            />
            <button
              type="button"
              className="text-xs font-semibold text-accent hover:underline"
              onClick={() => setSvg(EXAMPLE_SVG)}
            >
              Вставить пример звезды
            </button>
          </label>

          {svg.trim() && (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg-soft/50 px-4 py-3">
              <span
                className="inline-flex size-8 text-accent-deep [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div>
                <p className="text-sm font-semibold">{name || "Без названия"}</p>
                <p className="text-xs text-ink-muted">
                  {description || "Описание при наведении"}
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {editingId ? "Сохранить" : "Создать"}
            </button>
            {editingId && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setDescription("");
                  setSvg("");
                  setError(null);
                }}
                className="rounded-2xl border border-line px-4 py-2.5 text-sm text-ink-muted"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </AdminSection>

      <AdminSection title={`Каталог (${items.length})`}>
        <div className="divide-y divide-line">
          {items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">
              Пока нет ачивок — создайте первую выше.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex size-8 shrink-0 text-accent-deep [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                  <div>
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-sm text-ink-muted">{item.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(item.id)}
                    className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(item.id)}
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
