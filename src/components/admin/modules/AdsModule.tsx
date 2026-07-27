"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AD_PLACEMENT_HINTS,
  AD_PLACEMENT_LABELS,
  AD_TYPE_LABELS,
  AD_TYPE_PLACEMENTS,
  BANNER_SPECS,
  formatCtr,
} from "@/lib/ads";
import type { AdCreative, AdPlacement, AdType } from "@/lib/store-types";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  StatusPill,
} from "@/components/admin/ui";

type FormState = {
  name: string;
  type: AdType;
  placement: AdPlacement;
  title: string;
  body: string;
  href: string;
  imageUrl: string;
  exchangerId: string;
  active: boolean;
  priority: string;
  startsAt: string;
  endsAt: string;
};

const emptyForm = (): FormState => ({
  name: "",
  type: "banner",
  placement: "dashboard",
  title: "",
  body: "",
  href: "",
  imageUrl: "",
  exchangerId: "",
  active: true,
  priority: "10",
  startsAt: "",
  endsAt: "",
});

function formFromAd(ad: AdCreative): FormState {
  return {
    name: ad.name,
    type: ad.type,
    placement: ad.placement,
    title: ad.title,
    body: ad.body,
    href: ad.href,
    imageUrl: ad.imageUrl,
    exchangerId: ad.exchangerId ?? "",
    active: ad.active,
    priority: String(ad.priority),
    startsAt: ad.startsAt ? ad.startsAt.slice(0, 16) : "",
    endsAt: ad.endsAt ? ad.endsAt.slice(0, 16) : "",
  };
}

export function AdsModule() {
  const { overview, busy, setBusy, refresh } = useAdmin();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ads = overview?.ads ?? [];
  const exchangers = overview?.exchangers ?? [];
  const placements = AD_TYPE_PLACEMENTS[form.type];

  const payload = useMemo(
    () => ({
      name: form.name,
      type: form.type,
      placement: form.placement,
      title: form.title,
      body: form.body,
      href: form.href,
      imageUrl: form.imageUrl,
      exchangerId: form.exchangerId || null,
      active: form.active,
      priority: Number(form.priority) || 0,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    }),
    [form],
  );

  function onTypeChange(type: AdType) {
    const nextPlacement = AD_TYPE_PLACEMENTS[type][0];
    setForm((f) => ({ ...f, type, placement: nextPlacement }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ads", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { id: editingId, ...payload } : payload,
        ),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить");
        return;
      }
      setForm(emptyForm());
      setEditingId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    setBusy(true);
    try {
      await fetch("/api/admin/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить рекламу?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/ads?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resetStats(id: string) {
    if (!confirm("Сбросить статистику этого объявления?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resetStats: true }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const totals = useMemo(() => {
    return ads.reduce(
      (acc, ad) => {
        const s = ad.stats ?? { impressions: 0, clicks: 0 };
        acc.impressions += s.impressions;
        acc.clicks += s.clicks;
        return acc;
      },
      { impressions: 0, clicks: 0 },
    );
  }, [ads]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Реклама"
        description={
          <>
            Баннеры ротируются в слоте (вес = приоритет). Цены для рекламодателей
            — в{" "}
            <Link
              href={`${ADMIN_PATH}/ad-tariffs`}
              className="text-accent underline underline-offset-2"
            >
              тарифах
            </Link>
            .
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
            Показы
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {totals.impressions}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
            Клики
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {totals.clicks}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
            Конверсия общая
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {formatCtr(totals)}
          </p>
        </div>
      </div>

      <AdminSection
        title={editingId ? "Редактировать креатив" : "Новый креатив"}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Имя в админке</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Приоритет</span>
              <input
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Тип</span>
              <select
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value as AdType)}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {(Object.keys(AD_TYPE_LABELS) as AdType[]).map((t) => (
                  <option key={t} value={t}>
                    {AD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Место</span>
              <select
                value={form.placement}
                onChange={(e) =>
                  setForm({
                    ...form,
                    placement: e.target.value as AdPlacement,
                  })
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {placements.map((p) => (
                  <option key={p} value={p}>
                    {AD_PLACEMENT_LABELS[p]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-muted">
                {AD_PLACEMENT_HINTS[form.placement]}
              </p>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">
                {form.type === "banner"
                  ? "Заголовок (alt / запасной текст)"
                  : "Заголовок"}
              </span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Ссылка</span>
              <input
                value={form.href}
                onChange={(e) => setForm({ ...form, href: e.target.value })}
                placeholder="https://"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>

          {form.type !== "banner" ? (
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">
                {form.type === "ticker"
                  ? "Текст бегущей строки (опц.)"
                  : "Текст"}
              </span>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={2}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
          ) : null}

          {form.type === "banner" ? (
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">
                Картинка (URL)
                {BANNER_SPECS[form.placement]
                  ? ` · оптимально ${BANNER_SPECS[form.placement]!.sizeLabel} px, JPG/PNG/WebP`
                  : ""}
              </span>
              <input
                value={form.imageUrl}
                onChange={(e) =>
                  setForm({ ...form, imageUrl: e.target.value })
                }
                required
                placeholder="https://…/banner.png"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <p className="text-xs text-ink-muted">
                Баннер показывается как изображение на всю ширину контента.
                Без картинки — текстовая карточка (лучше всегда грузить
                креатив нужного размера).
              </p>
            </label>
          ) : null}

          {(form.type === "highlight" || form.type === "rates_pin") && (
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Обменник</span>
              <select
                value={form.exchangerId}
                onChange={(e) =>
                  setForm({ ...form, exchangerId: e.target.value })
                }
                required
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                <option value="">Выберите…</option>
                {exchangers.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.status})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Старт (опц.)</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  setForm({ ...form, startsAt: e.target.value })
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Конец (опц.)</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Активна
          </label>

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
                  setForm(emptyForm());
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

      <AdminSection title={`Креативы и статистика (${ads.length})`}>
        <div className="divide-y divide-line">
          {ads.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Пока пусто</p>
          ) : (
            ads.map((ad) => {
              const stats = ad.stats ?? {
                impressions: 0,
                clicks: 0,
                lastImpressionAt: null,
                lastClickAt: null,
                daily: [],
              };
              const daily = [...(stats.daily ?? [])]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 14);
              return (
                <div key={ad.id} className="space-y-4 px-5 py-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{ad.name}</p>
                        <StatusPill status={ad.active ? "active" : "hidden"} />
                        <span className="text-xs text-ink-muted">
                          {AD_TYPE_LABELS[ad.type]} ·{" "}
                          {AD_PLACEMENT_LABELS[ad.placement]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink">{ad.title}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        приоритет {ad.priority}
                        {ad.exchangerId ? ` · обменник ${ad.exchangerId}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(ad.id);
                          setForm(formFromAd(ad));
                          setError(null);
                        }}
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggle(ad.id, !ad.active)}
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                      >
                        {ad.active ? "Выключить" : "Включить"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resetStats(ad.id)}
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                      >
                        Сбросить статистику
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(ad.id)}
                        className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatBox label="Показы" value={String(stats.impressions)} />
                    <StatBox label="Клики" value={String(stats.clicks)} />
                    <StatBox label="Конверсия" value={formatCtr(stats)} />
                    <StatBox
                      label="Последний клик"
                      value={
                        stats.lastClickAt
                          ? new Date(stats.lastClickAt).toLocaleString("ru-RU")
                          : "—"
                      }
                    />
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-line">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-bg-soft text-ink-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">День (UTC)</th>
                          <th className="px-3 py-2 font-medium">Показы</th>
                          <th className="px-3 py-2 font-medium">Клики</th>
                          <th className="px-3 py-2 font-medium">Конверсия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daily.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-3 text-ink-muted"
                            >
                              Пока нет дневной статистики — откройте публичную
                              страницу со слотом.
                            </td>
                          </tr>
                        ) : (
                          daily.map((d) => (
                            <tr key={d.date} className="border-t border-line">
                              <td className="px-3 py-2 tabular-nums text-ink">
                                {d.date}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-ink">
                                {d.impressions}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-ink">
                                {d.clicks}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-ink">
                                {formatCtr(d)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AdminSection>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-bg-soft/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}
