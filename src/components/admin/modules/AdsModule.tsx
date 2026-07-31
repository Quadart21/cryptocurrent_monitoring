"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { adMediaIsVideo } from "@/lib/ad-image-url";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminTabBar,
  StatusPill,
} from "@/components/admin/ui";

const BANNER_SIZE_ROWS = (
  Object.keys(BANNER_SPECS) as AdPlacement[]
).flatMap((placement) => {
  const spec = BANNER_SPECS[placement];
  if (!spec) return [];
  return [
    {
      placement,
      label: AD_PLACEMENT_LABELS[placement],
      sizeLabel: spec.sizeLabel,
      hint: AD_PLACEMENT_HINTS[placement],
    },
  ];
});

type FormState = {
  name: string;
  type: AdType;
  placement: AdPlacement;
  title: string;
  body: string;
  href: string;
  imageUrl: string;
  imageFormat: string | null;
  exchangerId: string;
  /** empty = everywhere; otherwise selected FROM:TO keys */
  pairs: string[];
  pairScope: "everywhere" | "pairs";
  active: boolean;
  priority: string;
  startsAt: string;
  endsAt: string;
};

type ExchangerPairOption = { from: string; to: string; key: string };

const emptyForm = (): FormState => ({
  name: "",
  type: "banner",
  placement: "dashboard",
  title: "",
  body: "",
  href: "",
  imageUrl: "",
  imageFormat: null,
  exchangerId: "",
  pairs: [],
  pairScope: "everywhere",
  active: true,
  priority: "10",
  startsAt: "",
  endsAt: "",
});

function formFromAd(ad: AdCreative): FormState {
  const pairs = ad.pairs ?? [];
  return {
    name: ad.name,
    type: ad.type,
    placement: ad.placement,
    title: ad.title,
    body: ad.body,
    href: ad.href,
    imageUrl: ad.imageUrl,
    imageFormat: ad.image?.format ?? null,
    exchangerId: ad.exchangerId ?? "",
    pairs,
    pairScope: pairs.length ? "pairs" : "everywhere",
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [exchangerPairs, setExchangerPairs] = useState<ExchangerPairOption[]>(
    [],
  );
  const [pairsLoading, setPairsLoading] = useState(false);
  const [tab, setTab] = useState<"list" | "form">("list");
  const [expandedStatsId, setExpandedStatsId] = useState<string | null>(null);

  const ads = overview?.ads ?? [];
  const exchangers = overview?.exchangers ?? [];
  const placements = AD_TYPE_PLACEMENTS[form.type];
  const needsExchanger =
    form.type === "highlight" || form.type === "rates_pin";
  const showPairScope = form.type === "rates_pin";

  useEffect(() => {
    if (!showPairScope || !form.exchangerId) {
      setExchangerPairs([]);
      return;
    }
    let cancelled = false;
    setPairsLoading(true);
    void fetch(
      `/api/admin/ads?exchangerId=${encodeURIComponent(form.exchangerId)}`,
      { cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { pairs?: ExchangerPairOption[] } | null) => {
        if (cancelled) return;
        const pairs = data?.pairs ?? [];
        setExchangerPairs(pairs);
        // Drop stale keys only when we know the exchanger's live pairs.
        if (pairs.length) {
          setForm((f) => ({
            ...f,
            pairs: f.pairs.filter((key) => pairs.some((p) => p.key === key)),
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setExchangerPairs([]);
      })
      .finally(() => {
        if (!cancelled) setPairsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showPairScope, form.exchangerId]);

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
      pairs:
        showPairScope && form.pairScope === "pairs" ? form.pairs : [],
      active: form.active,
      priority: Number(form.priority) || 0,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    }),
    [form, showPairScope],
  );

  function onTypeChange(type: AdType) {
    const nextPlacement = AD_TYPE_PLACEMENTS[type][0];
    setForm((f) => ({
      ...f,
      type,
      placement: nextPlacement,
      pairs: type === "rates_pin" ? f.pairs : [],
      pairScope: type === "rates_pin" ? f.pairScope : "everywhere",
    }));
  }

  function togglePair(key: string) {
    setForm((f) => {
      const has = f.pairs.includes(key);
      return {
        ...f,
        pairs: has ? f.pairs.filter((k) => k !== key) : [...f.pairs, key],
      };
    });
  }

  async function readApiJson(res: Response): Promise<{ error?: string }> {
    const text = await res.text();
    try {
      return JSON.parse(text) as { error?: string };
    } catch {
      if (res.status === 413) {
        throw new Error(
          "Файл слишком большой для прокси (nginx). Нужен client_max_body_size 10m",
        );
      }
      throw new Error(
        res.status
          ? `Ошибка сервера (${res.status})`
          : "Некорректный ответ сервера",
      );
    }
  }

  async function uploadAdImage(adId: string, file: File) {
    const fd = new FormData();
    fd.set("id", adId);
    fd.set("image", file);
    const res = await fetch("/api/admin/ads/image", {
      method: "POST",
      body: fd,
    });
    const body = await readApiJson(res);
    if (!res.ok) {
      throw new Error(body.error ?? "Не удалось загрузить картинку");
    }
  }

  async function removeAdImage(adId: string) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("id", adId);
      fd.set("remove", "1");
      const res = await fetch("/api/admin/ads/image", {
        method: "POST",
        body: fd,
      });
      const body = await readApiJson(res);
      if (!res.ok) {
        setError(body.error ?? "Не удалось удалить картинку");
        return;
      }
      setForm((f) => ({ ...f, imageUrl: "", imageFormat: null }));
      setImageFile(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      showPairScope &&
      form.pairScope === "pairs" &&
      form.pairs.length === 0
    ) {
      setError("Выберите хотя бы одну пару или режим «везде»");
      return;
    }
    if (form.type === "banner" && !imageFile && !form.imageUrl.trim()) {
      setError("Загрузите картинку с ПК или укажите URL");
      return;
    }
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
      const body = (await res.json()) as { error?: string; ad?: AdCreative };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить");
        return;
      }

      const adId = editingId ?? body.ad?.id;
      if (form.type === "banner" && imageFile && adId) {
        try {
          await uploadAdImage(adId, imageFile);
        } catch (err) {
          setError(
            err instanceof Error
              ? `Креатив сохранён, но картинка не принята: ${err.message}`
              : "Креатив сохранён, но картинка не принята",
          );
          setEditingId(adId);
          setForm(body.ad ? formFromAd(body.ad) : form);
          setImageFile(null);
          await refresh();
          return;
        }
      }

      setForm(emptyForm());
      setEditingId(null);
      setImageFile(null);
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
        setImageFile(null);
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
            Баннеры ротируются в слоте (вес = приоритет). Закреп в курсах можно
            показывать везде или только на выбранных парах. Цены — в{" "}
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

      <AdminTabBar
        tabs={[
          { id: "list", label: "Креативы", badge: ads.length },
          { id: "form", label: editingId ? "Редактирование" : "Форма" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "form" ? (
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
                    {form.type === "banner" && BANNER_SPECS[p]
                      ? ` · ${BANNER_SPECS[p]!.sizeLabel} px`
                      : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-muted">
                {AD_PLACEMENT_HINTS[form.placement]}
                {form.type === "banner" && BANNER_SPECS[form.placement]
                  ? ` · размер креатива ${BANNER_SPECS[form.placement]!.sizeLabel} px`
                  : ""}
              </p>
            </label>
          </div>

          {form.type === "banner" ? (
            <div className="rounded-2xl border border-line bg-bg-soft/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Размеры баннеров
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink">
                {BANNER_SIZE_ROWS.map((row) => (
                  <li
                    key={row.placement}
                    className={
                      row.placement === form.placement
                        ? "font-semibold text-accent"
                        : "text-ink-muted"
                    }
                  >
                    <span className="tabular-nums">{row.sizeLabel}</span>
                    {" — "}
                    {row.label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-muted">
                JPG / PNG / WebP / AVIF / GIF / SVG до 3 МБ; короткое MP4 / WebM
                до 8 МБ (muted loop). SVG конвертируется в WebP. Берите точный
                размер выбранного слота.
              </p>
            </div>
          ) : null}

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
            <div className="space-y-3">
              <div className="space-y-2">
                <span className="text-xs text-ink-muted">
                  Файл с ПК
                  {BANNER_SPECS[form.placement]
                    ? ` · нужно ${BANNER_SPECS[form.placement]!.sizeLabel} px`
                    : ""}
                </span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.mp4,.webm,.m4v,image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,video/mp4,video/webm"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-ink file:mr-3 file:rounded-xl file:border-0 file:bg-accent/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-accent"
                />
                {imageFile ? (
                  <p className="text-xs text-ink-muted">
                    Новый файл: {imageFile.name}
                  </p>
                ) : null}
                {form.imageUrl ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {adMediaIsVideo({
                      format: form.imageFormat,
                      url: form.imageUrl,
                    }) ? (
                      <video
                        src={form.imageUrl}
                        className="h-12 max-w-[240px] rounded-lg border border-line object-cover"
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.imageUrl}
                        alt=""
                        className="h-12 max-w-[240px] rounded-lg border border-line object-cover"
                      />
                    )}
                    {editingId ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeAdImage(editingId)}
                        className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                      >
                        Удалить файл
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-ink-muted">
                  Или URL файла (если уже хостится)
                </span>
                <input
                  value={form.imageUrl.startsWith("/api/ad-images/") ? "" : form.imageUrl}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      imageUrl: e.target.value,
                      imageFormat: null,
                    })
                  }
                  placeholder="https://…/banner.webp или .mp4"
                  disabled={Boolean(imageFile)}
                  className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-60"
                />
              </label>
              <p className="text-xs text-ink-muted">
                Баннер тянется на ширину контента. Без файла или URL — текстовая
                карточка. Для анимации лучше WebP или короткий MP4/WebM, не GIF.
              </p>
            </div>
          ) : null}

          {needsExchanger ? (
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Обменник</span>
              <select
                value={form.exchangerId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    exchangerId: e.target.value,
                    pairs: [],
                  })
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
          ) : null}

          {showPairScope ? (
            <div className="space-y-3 rounded-2xl border border-line bg-bg-soft/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Область закрепа
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-ink">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pairScope"
                    checked={form.pairScope === "everywhere"}
                    onChange={() =>
                      setForm({ ...form, pairScope: "everywhere", pairs: [] })
                    }
                  />
                  Везде (все пары, где есть этот обменник)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pairScope"
                    checked={form.pairScope === "pairs"}
                    onChange={() =>
                      setForm({ ...form, pairScope: "pairs" })
                    }
                  />
                  Только выбранные пары
                </label>
              </div>

              {form.pairScope === "pairs" ? (
                <div className="space-y-2">
                  {!form.exchangerId ? (
                    <p className="text-xs text-ink-muted">
                      Сначала выберите обменник — покажем его направления из
                      XML.
                    </p>
                  ) : pairsLoading ? (
                    <p className="text-xs text-ink-muted">Загрузка пар…</p>
                  ) : exchangerPairs.length === 0 ? (
                    <p className="text-xs text-[var(--warn)]">
                      У обменника пока нет направлений в фиде.
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-line bg-input p-2">
                      <div className="grid gap-1 sm:grid-cols-2">
                        {exchangerPairs.map((p) => {
                          const checked = form.pairs.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                                checked
                                  ? "bg-accent-soft text-ink"
                                  : "text-ink-muted hover:bg-bg-soft"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePair(p.key)}
                              />
                              <span className="tabular-nums">
                                {p.from} → {p.to}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {form.pairs.length > 0 ? (
                    <p className="text-xs text-ink-muted">
                      Выбрано: {form.pairs.length}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

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
                  setImageFile(null);
                  setError(null);
                  setTab("list");
                }}
                className="rounded-2xl border border-line px-4 py-2.5 text-sm text-ink-muted"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </AdminSection>
      ) : null}

      {tab === "list" ? (
      <AdminSection title={`Креативы (${ads.length})`}>
        <div className="flex justify-end border-b border-line px-5 py-3">
          <button
            type="button"
            disabled={busy}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm());
              setImageFile(null);
              setError(null);
              setTab("form");
            }}
          >
            Новый креатив
          </button>
        </div>
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
              const exName =
                exchangers.find((e) => e.id === ad.exchangerId)?.name ??
                ad.exchangerId;
              const pairLabel =
                ad.type === "rates_pin"
                  ? !(ad.pairs ?? []).length
                    ? "везде"
                    : `${ad.pairs.length} пар`
                  : null;
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
                        {exName ? ` · ${exName}` : ""}
                        {pairLabel ? ` · ${pairLabel}` : ""}
                      </p>
                      {(ad.pairs ?? []).length > 0 ? (
                        <p className="mt-1 text-xs text-ink-muted">
                          {(ad.pairs ?? [])
                            .slice(0, 8)
                            .map((k) => k.replace(":", " → "))
                            .join(", ")}
                          {(ad.pairs ?? []).length > 8
                            ? `… +${(ad.pairs ?? []).length - 8}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(ad.id);
                          setForm(formFromAd(ad));
                          setImageFile(null);
                          setError(null);
                          setTab("form");
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
                        onClick={() =>
                          setExpandedStatsId((id) =>
                            id === ad.id ? null : ad.id,
                          )
                        }
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                      >
                        Статистика
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
                    {expandedStatsId === ad.id ? (
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
                    ) : null}
                  </div>
                  {expandedStatsId === ad.id ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resetStats(ad.id)}
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                      >
                        Сбросить статистику
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </AdminSection>
      ) : null}
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
