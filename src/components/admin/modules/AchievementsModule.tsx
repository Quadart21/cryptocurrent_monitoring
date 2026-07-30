"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection } from "@/components/admin/ui";
import { ACHIEVEMENT_RULE_KINDS } from "@/lib/achievement-rules";
import type {
  AchievementMode,
  AchievementRule,
  AchievementRuleKind,
} from "@/lib/store-types";

const EXAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.3 7L12 16.8 5.7 21 8 14 2 9.2h7.6L12 2z"/></svg>`;

const emptyRule = (kind: AchievementRuleKind = "rating_min"): AchievementRule => ({
  kind,
});

function ruleSummary(rule: AchievementRule | null): string {
  if (!rule) return "—";
  const label =
    ACHIEVEMENT_RULE_KINDS.find((k) => k.kind === rule.kind)?.label ?? rule.kind;
  const bits: string[] = [label];
  if (rule.minRating !== undefined) bits.push(`рейтинг ≥ ${rule.minRating}`);
  if (rule.minReviews !== undefined) bits.push(`отзывов ≥ ${rule.minReviews}`);
  if (rule.minAgeYears !== undefined) bits.push(`лет ≥ ${rule.minAgeYears}`);
  if (rule.minPairs !== undefined) bits.push(`пар ≥ ${rule.minPairs}`);
  if (rule.maxSyncAgeHours !== undefined)
    bits.push(`синк ≤ ${rule.maxSyncAgeHours}ч`);
  if (rule.maxAgeDays !== undefined) bits.push(`дней ≤ ${rule.maxAgeDays}`);
  if (rule.minPositiveRatio !== undefined)
    bits.push(`позитив ≥ ${rule.minPositiveRatio}`);
  if (rule.minReserveSum !== undefined)
    bits.push(`резерв ≥ ${rule.minReserveSum}`);
  return bits.join(" · ");
}

export function AchievementsModule() {
  const { overview, busy, setBusy, refresh } = useAdmin();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [svg, setSvg] = useState("");
  const [mode, setMode] = useState<AchievementMode>("manual");
  const [rule, setRule] = useState<AchievementRule>(emptyRule());
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null);

  const items = overview?.achievements ?? [];

  const payloadRule = useMemo(
    () => (mode === "auto" ? rule : null),
    [mode, rule],
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setSvg("");
    setMode("manual");
    setRule(emptyRule());
    setError(null);
    setPreviewMsg(null);
  }

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
            ? {
                id: editingId,
                name,
                description,
                svg,
                mode,
                rule: payloadRule,
              }
            : { name, description, svg, mode, rule: payloadRule },
        ),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить");
        return;
      }
      resetForm();
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
    setMode(item.mode ?? "manual");
    setRule(item.rule ?? emptyRule());
    setError(null);
    setPreviewMsg(null);
  }

  async function remove(id: string) {
    if (!confirm("Удалить ачивку? Она снимется со всех обменников.")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/achievements?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (editingId === id) resetForm();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function previewMatches() {
    if (mode !== "auto") return;
    setBusy(true);
    setPreviewMsg(null);
    try {
      const res = await fetch("/api/admin/achievements/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", rule }),
      });
      const body = (await res.json()) as { matches?: number; error?: string };
      if (!res.ok) {
        setPreviewMsg(body.error ?? "Ошибка превью");
        return;
      }
      setPreviewMsg(
        `Сейчас подходит: ${body.matches ?? 0} активных обменник(ов)`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function recomputeNow() {
    setBusy(true);
    setRecomputeMsg(null);
    try {
      const res = await fetch("/api/admin/achievements/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as {
        checked?: number;
        updated?: number;
        autoRules?: number;
        error?: string;
      };
      if (!res.ok) {
        setRecomputeMsg(body.error ?? "Ошибка пересчёта");
        return;
      }
      setRecomputeMsg(
        `Пересчитано: ${body.checked ?? 0} обменников, обновлено ${body.updated ?? 0} (авто-правил: ${body.autoRules ?? 0})`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function patchRule(partial: Partial<AchievementRule>) {
    setRule((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ачивки"
        description="Ручные — выдаёте сами в карточке обменника. Авто — система ставит/снимает по правилу с порогами."
      />

      <AdminSection title="Пересчёт авто-ачивок">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void recomputeNow()}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Пересчитать сейчас
          </button>
          {recomputeMsg && (
            <p className="text-sm text-ink-muted">{recomputeMsg}</p>
          )}
        </div>
      </AdminSection>

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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Режим
              </span>
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value === "auto" ? "auto" : "manual")
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                <option value="manual">Ручная (выдаёте сами)</option>
                <option value="auto">Авто (по правилу)</option>
              </select>
            </label>
          </div>

          {mode === "auto" && (
            <div className="space-y-3 rounded-2xl border border-line bg-bg-soft/40 p-4">
              <label className="block space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                  Правило
                </span>
                <select
                  value={rule.kind}
                  onChange={(e) =>
                    setRule(emptyRule(e.target.value as AchievementRuleKind))
                  }
                  className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {ACHIEVEMENT_RULE_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label} — {k.hint}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(rule.kind === "rating_min" ||
                  rule.kind === "newcomer") && (
                  <NumField
                    label="Мин. рейтинг"
                    value={rule.minRating}
                    onChange={(v) => patchRule({ minRating: v })}
                    step="0.1"
                  />
                )}
                {(rule.kind === "rating_min" ||
                  rule.kind === "reviews_min" ||
                  rule.kind === "positive_ratio_min" ||
                  rule.kind === "newcomer") && (
                  <NumField
                    label="Мин. отзывов"
                    value={rule.minReviews}
                    onChange={(v) => patchRule({ minReviews: v })}
                  />
                )}
                {rule.kind === "age_years_min" && (
                  <NumField
                    label="Мин. лет"
                    value={rule.minAgeYears}
                    onChange={(v) => patchRule({ minAgeYears: v })}
                  />
                )}
                {rule.kind === "pair_count_min" && (
                  <NumField
                    label="Мин. направлений"
                    value={rule.minPairs}
                    onChange={(v) => patchRule({ minPairs: v })}
                  />
                )}
                {rule.kind === "sync_fresh" && (
                  <NumField
                    label="Макс. часов с синка"
                    value={rule.maxSyncAgeHours}
                    onChange={(v) => patchRule({ maxSyncAgeHours: v })}
                  />
                )}
                {rule.kind === "newcomer" && (
                  <NumField
                    label="Макс. дней с одобрения"
                    value={rule.maxAgeDays}
                    onChange={(v) => patchRule({ maxAgeDays: v })}
                  />
                )}
                {rule.kind === "positive_ratio_min" && (
                  <NumField
                    label="Мин. доля позитивных (0–1)"
                    value={rule.minPositiveRatio}
                    onChange={(v) => patchRule({ minPositiveRatio: v })}
                    step="0.01"
                  />
                )}
                {rule.kind === "reserve_sum_min" && (
                  <NumField
                    label="Мин. сумма резервов"
                    value={rule.minReserveSum}
                    onChange={(v) => patchRule({ minReserveSum: v })}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void previewMatches()}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                >
                  Сколько подходит сейчас
                </button>
                {previewMsg && (
                  <p className="text-sm text-ink-muted">{previewMsg}</p>
                )}
              </div>
            </div>
          )}

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
                onClick={resetForm}
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
                    <p className="font-semibold text-ink">
                      {item.name}{" "}
                      <span className="text-xs font-medium text-ink-muted">
                        · {item.mode === "auto" ? "авто" : "ручная"}
                      </span>
                    </p>
                    <p className="text-sm text-ink-muted">{item.description}</p>
                    {item.mode === "auto" && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {ruleSummary(item.rule)}
                      </p>
                    )}
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

function NumField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className="w-full rounded-xl border border-line bg-input px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
