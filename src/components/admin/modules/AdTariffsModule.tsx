"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  AD_PERIOD_LABELS,
  AD_PLACEMENT_LABELS,
  AD_TYPE_LABELS,
  AD_TYPE_PLACEMENTS,
  BANNER_SPECS,
  formatAdPrice,
} from "@/lib/ads";
import type {
  AdPlacement,
  AdPricingSettings,
  AdTariff,
  AdTariffPeriod,
  AdType,
} from "@/lib/store-types";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminDrawer,
  AdminPageHeader,
  AdminSection,
  AdminTabBar,
  StatusPill,
} from "@/components/admin/ui";

type TabId = "tariffs" | "page";

type Draft = {
  title: string;
  description: string;
  sizeLabel: string;
  price: string;
  period: AdTariffPeriod;
  featuresText: string;
  active: boolean;
  sortOrder: string;
};

function draftFrom(t: AdTariff): Draft {
  return {
    title: t.title,
    description: t.description,
    sizeLabel: t.sizeLabel,
    price: String(t.price),
    period: t.period,
    featuresText: t.features.join("\n"),
    active: t.active,
    sortOrder: String(t.sortOrder),
  };
}

export function AdTariffsModule() {
  const { busy, setBusy } = useAdmin();
  const [tab, setTab] = useState<TabId>("tariffs");
  const [tariffs, setTariffs] = useState<AdTariff[]>([]);
  const [pricing, setPricing] = useState<AdPricingSettings>({
    contact: "",
    intro: "",
    note: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<AdType>("banner");
  const [newPlacement, setNewPlacement] = useState<AdPlacement>("dashboard");
  const [newPrice, setNewPrice] = useState("10000");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ad-tariffs", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      tariffs: AdTariff[];
      pricing: AdPricingSettings;
    };
    setTariffs(data.tariffs);
    setPricing(data.pricing);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePricing(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/ad-tariffs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "pricing", ...pricing }),
      });
      if (!res.ok) throw new Error("fail");
      setOk("Контакты и текст страницы сохранены");
      await load();
    } catch {
      setError("Не удалось сохранить настройки");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(t: AdTariff) {
    setEditingId(t.id);
    setDraft(draftFrom(t));
    setError(null);
    setOk(null);
  }

  function closeEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveTariff(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !draft) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/ad-tariffs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "tariff",
          id: editingId,
          title: draft.title,
          description: draft.description,
          sizeLabel: draft.sizeLabel,
          price: Number(draft.price) || 0,
          period: draft.period,
          features: draft.featuresText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          active: draft.active,
          sortOrder: Number(draft.sortOrder) || 0,
        }),
      });
      if (!res.ok) throw new Error("fail");
      closeEdit();
      setOk("Тариф обновлён");
      await load();
    } catch {
      setError("Не удалось сохранить тариф");
    } finally {
      setBusy(false);
    }
  }

  async function addTariff(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-tariffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          type: newType,
          placement: newPlacement,
          price: Number(newPrice) || 0,
          sizeLabel: BANNER_SPECS[newPlacement]?.sizeLabel ?? "",
          period: "week",
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось добавить");
        return;
      }
      setNewTitle("");
      await load();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить тариф?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/ad-tariffs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (editingId === id) closeEdit();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const editingTariff = editingId
    ? tariffs.find((t) => t.id === editingId)
    : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Тарифы рекламы"
        description="Цены и тексты на публичной странице /advertise. Креативы — в разделе «Реклама»."
      />

      {(error || ok) && (
        <p className={`text-sm ${error ? "text-danger" : "text-ok"}`}>
          {error ?? ok}
        </p>
      )}

      <AdminTabBar
        tabs={[
          { id: "tariffs", label: "Тарифы", badge: tariffs.length },
          { id: "page", label: "Страница" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "page" ? (
        <AdminSection title="Страница для рекламодателей">
          <form onSubmit={(e) => void savePricing(e)} className="space-y-3 p-5">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">
                Контакт для рекламы
              </span>
              <input
                value={pricing.contact}
                onChange={(e) =>
                  setPricing((p) => ({ ...p, contact: e.target.value }))
                }
                placeholder="пусто = email/Telegram из SEO → Контакты"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <span className="block text-xs text-ink-muted">
                Если пусто — берётся публичный контакт из раздела SEO → Контакты.
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Вводный текст</span>
              <textarea
                value={pricing.intro}
                onChange={(e) =>
                  setPricing((p) => ({ ...p, intro: e.target.value }))
                }
                rows={3}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Сноска под тарифами</span>
              <textarea
                value={pricing.note}
                onChange={(e) =>
                  setPricing((p) => ({ ...p, note: e.target.value }))
                }
                rows={2}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Сохранить тексты
            </button>
          </form>
        </AdminSection>
      ) : null}

      {tab === "tariffs" ? (
        <>
          <AdminSection title="Добавить тариф">
            <form
              onSubmit={(e) => void addTariff(e)}
              className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5"
            >
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                placeholder="Название"
                className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent lg:col-span-2"
              />
              <select
                value={newType}
                onChange={(e) => {
                  const type = e.target.value as AdType;
                  setNewType(type);
                  setNewPlacement(AD_TYPE_PLACEMENTS[type][0]!);
                }}
                className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {(Object.keys(AD_TYPE_LABELS) as AdType[]).map((t) => (
                  <option key={t} value={t}>
                    {AD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <select
                value={newPlacement}
                onChange={(e) => setNewPlacement(e.target.value as AdPlacement)}
                className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {AD_TYPE_PLACEMENTS[newType].map((p) => (
                  <option key={p} value={p}>
                    {AD_PLACEMENT_LABELS[p]}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  type="number"
                  min={0}
                  required
                  className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold"
                >
                  +
                </button>
              </div>
            </form>
          </AdminSection>

          <AdminSection title={`Тарифы (${tariffs.length})`}>
            <div className="divide-y divide-line">
              {tariffs.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{t.title}</p>
                      {t.active ? (
                        <StatusPill status="active" />
                      ) : (
                        <StatusPill status="rejected" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {AD_TYPE_LABELS[t.type]} · {AD_PLACEMENT_LABELS[t.placement]}{" "}
                      · {t.sizeLabel || "—"} ·{" "}
                      {formatAdPrice(t.price)} / {AD_PERIOD_LABELS[t.period]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(t)}
                      className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(t.id)}
                      className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </AdminSection>
        </>
      ) : null}

      <AdminDrawer
        open={Boolean(editingId && draft)}
        onClose={closeEdit}
        title={editingTariff ? `Редактировать: ${editingTariff.title}` : "Редактировать тариф"}
        widthClassName="max-w-xl"
      >
        {draft ? (
          <form onSubmit={(e) => void saveTariff(e)} className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-ink-muted">Название</span>
              <input
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value })
                }
                required
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-ink-muted">Описание</span>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                rows={2}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Размер / формат</span>
              <input
                value={draft.sizeLabel}
                onChange={(e) =>
                  setDraft({ ...draft, sizeLabel: e.target.value })
                }
                placeholder="1200×90"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Цена, ₽</span>
              <input
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) =>
                  setDraft({ ...draft, price: e.target.value })
                }
                required
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Период</span>
              <select
                value={draft.period}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    period: e.target.value as AdTariffPeriod,
                  })
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {(Object.keys(AD_PERIOD_LABELS) as AdTariffPeriod[]).map(
                  (p) => (
                    <option key={p} value={p}>
                      {AD_PERIOD_LABELS[p]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Порядок</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: e.target.value })
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-ink-muted">
                Преимущества (по строке)
              </span>
              <textarea
                value={draft.featuresText}
                onChange={(e) =>
                  setDraft({ ...draft, featuresText: e.target.value })
                }
                rows={3}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
              />
              Показывать на /advertise
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 sm:justify-end">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold"
              >
                Сохранить тариф
              </button>
            </div>
          </form>
        ) : null}
      </AdminDrawer>
    </div>
  );
}
