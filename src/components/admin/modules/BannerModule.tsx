"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatGrid,
  StatusPill,
} from "@/components/admin/ui";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { bannerStatusLabel } from "@/lib/banner";

type FilterId = "problem" | "ok" | "pending" | "all";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "problem", label: "Проблемы" },
  { id: "ok", label: "Найден" },
  { id: "pending", label: "Не проверены" },
  { id: "all", label: "Все активные" },
];

function ownerEmailOf(ex: {
  ownerEmail?: string | null;
  contact?: string;
}): string | null {
  const direct = ex.ownerEmail?.trim().toLowerCase();
  if (direct) return direct;
  const match = (ex.contact ?? "").match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  return match ? match[0].toLowerCase() : null;
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

export function BannerModule() {
  const { overview, counts, busy, setBusy, refresh } = useAdmin();
  const [filter, setFilter] = useState<FilterId>("problem");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const active = useMemo(
    () =>
      (overview?.exchangers ?? []).filter(
        (e) => e.status === "active" || e.status === "error",
      ),
    [overview],
  );

  const rows = useMemo(() => {
    let list = active;
    if (filter === "problem") {
      list = list.filter(
        (e) =>
          e.bannerCheck?.status === "missing" ||
          e.bannerCheck?.status === "error",
      );
    } else if (filter === "ok") {
      list = list.filter((e) => e.bannerCheck?.status === "ok");
    } else if (filter === "pending") {
      list = list.filter(
        (e) =>
          !e.bannerCheck?.status ||
          e.bannerCheck.status === "pending",
      );
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(needle) ||
          e.website.toLowerCase().includes(needle) ||
          (e.ownerEmail ?? "").toLowerCase().includes(needle),
      );
    }
    return [...list].sort((a, b) => {
      const am = a.bannerCheck?.consecutiveMisses ?? 0;
      const bm = b.bannerCheck?.consecutiveMisses ?? 0;
      if (bm !== am) return bm - am;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [active, filter, q]);

  const stats = useMemo(() => {
    let ok = 0;
    let missing = 0;
    let errors = 0;
    let pending = 0;
    for (const e of active) {
      const st = e.bannerCheck?.status ?? "pending";
      if (st === "ok") ok += 1;
      else if (st === "missing") missing += 1;
      else if (st === "error") errors += 1;
      else pending += 1;
    }
    return { ok, missing, errors, pending };
  }, [active]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const ids = rows.map((r) => r.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function runAction(
    action: "check" | "warn" | "unpublish",
    opts?: { exchangerId?: string; notifyOwner?: boolean },
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { action };
      if (opts?.exchangerId) payload.exchangerId = opts.exchangerId;
      else if (action !== "check" && selected.size > 0) {
        payload.exchangerIds = [...selected];
      }
      if (action === "unpublish") {
        payload.notifyOwner = opts?.notifyOwner !== false;
      }

      const res = await fetch("/api/admin/banner-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as {
        error?: string;
        checked?: number;
        ok?: number;
        missing?: number;
        errors?: number;
        notified?: boolean;
        checkedAt?: string;
        okCount?: number;
        failCount?: number;
        results?: Array<{
          ok: boolean;
          error?: string;
          mailed?: boolean;
          mailTo?: string | null;
          warning?: string;
        }>;
      };
      if (!res.ok) throw new Error(body.error ?? "Ошибка");

      if (action === "check") {
        setLastRun(body.checkedAt ?? new Date().toISOString());
        setMessage(
          `Проверка: найдено ${body.ok}/${body.checked}, нет ${body.missing}, ошибок ${body.errors ?? 0}${
            body.notified ? " · алерт админу отправлен" : ""
          }`,
        );
      } else {
        const fails =
          body.results?.filter((r) => !r.ok).map((r) => r.error).filter(Boolean) ??
          [];
        const warnings =
          body.results
            ?.map((r) => r.warning)
            .filter((w): w is string => Boolean(w)) ?? [];
        setMessage(
          action === "warn"
            ? `Предупреждения: ${body.okCount ?? 0} отправлено${
                body.failCount ? `, ошибок ${body.failCount}` : ""
              }`
            : `Снято с публикации: ${body.okCount ?? 0}${
                body.failCount ? `, ошибок ${body.failCount}` : ""
              }`,
        );
        if (fails.length) setError(fails.slice(0, 3).join("; "));
        else if (warnings.length) setError(warnings.slice(0, 3).join("; "));
        setSelected(new Set());
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Баннер GapSnap"
        description="Раз в сутки проверяем HTML сайта обменника на кнопку GapSnap. Алерт на ADMIN_ALERT_EMAIL. Здесь — кто без баннера и что сделать."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void runAction("check")}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Проверить всех сейчас
          </button>
        }
      />

      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {message}
        </p>
      ) : null}

      <AdminStatGrid
        items={[
          {
            label: "Без баннера",
            value: counts?.bannerMissing ?? stats.missing + stats.errors,
            tone:
              (counts?.bannerMissing ?? 0) > 0 || stats.missing + stats.errors > 0
                ? "warn"
                : undefined,
          },
          { label: "Найден", value: stats.ok, tone: "ok" },
          { label: "Ошибка проверки", value: stats.errors },
          { label: "Ещё не проверены", value: stats.pending },
          {
            label: "Последний ручной прогон",
            value: lastRun ? new Date(lastRun).toLocaleString("ru-RU") : "—",
          },
        ]}
      />

      <AdminSection
        title="Что делать"
        description="Порядок работы с обменниками без кнопки"
      >
        <ol className="list-decimal space-y-2 px-5 py-5 pl-9 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">Проверить сайт</strong> — убедиться,
            что кнопка реально отсутствует (не сбой загрузки).
          </li>
          <li>
            <strong className="text-ink">Предупредить владельца</strong> —
            письмо с HTML-кодом и ссылкой в кабинет.
          </li>
          <li>
            <strong className="text-ink">Снять с публикации</strong> — если
            после предупреждений баннера нет: статус «отклонён», курсы
            пропадают из мониторинга. Можно сразу уведомить владельца.
          </li>
        </ol>
      </AdminSection>

      <AdminSection
        title="Обменники"
        description="Активные цели суточной проверки"
      >
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1 rounded-2xl border border-line bg-bg-soft p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    filter === f.id
                      ? "bg-accent text-white"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по имени, сайту, email…"
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm lg:max-w-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => void runAction("warn")}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
            >
              Предупредить выбранных ({selected.size})
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => {
                if (
                  !confirm(
                    `Снять с публикации ${selected.size} обменник(ов) и отправить письмо владельцам?`,
                  )
                ) {
                  return;
                }
                void runAction("unpublish", { notifyOwner: true });
              }}
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
            >
              Снять + письмо
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => {
                if (
                  !confirm(
                    `Снять с публикации ${selected.size} обменник(ов) без письма?`,
                  )
                ) {
                  return;
                }
                void runAction("unpublish", { notifyOwner: false });
              }}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted disabled:opacity-50"
            >
              Снять без письма
            </button>
            <button
              type="button"
              onClick={toggleAllVisible}
              className="ml-auto text-xs font-semibold text-accent hover:underline"
            >
              {rows.length > 0 && rows.every((r) => selected.has(r.id))
                ? "Снять выделение"
                : "Выбрать видимые"}
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">
              В этом фильтре пусто
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {rows.map((ex) => {
                const check = ex.bannerCheck;
                const status = check?.status ?? "pending";
                const email = ownerEmailOf(ex);
                const problem =
                  status === "missing" || status === "error";
                return (
                  <div
                    key={ex.id}
                    className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="flex min-w-0 gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(ex.id)}
                        onChange={() => toggle(ex.id)}
                        className="mt-1"
                        aria-label={`Выбрать ${ex.name}`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{ex.name}</p>
                          <StatusPill
                            status={
                              status === "ok"
                                ? "active"
                                : problem
                                  ? "error"
                                  : "pending"
                            }
                          />
                          <span className="text-xs text-ink-muted">
                            {bannerStatusLabel(status)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-ink-muted">
                          {ex.website || "сайт не указан"}
                          {check?.lastError ? ` · ${check.lastError}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-ink-muted">
                          Проверка: {formatWhen(check?.lastCheckAt)} · пропусков:{" "}
                          {check?.consecutiveMisses ?? 0}
                          {check?.missingSince
                            ? ` · нет с ${formatWhen(check.missingSince)}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-ink-muted">
                          Владелец: {email ?? "email не найден"}
                          {check?.lastOwnerWarnedAt
                            ? ` · предупреждён ${formatWhen(check.lastOwnerWarnedAt)} (${check.ownerWarnCount ?? 0}×)`
                            : " · ещё не предупреждали"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runAction("check", { exchangerId: ex.id })
                        }
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted disabled:opacity-60"
                      >
                        Проверить
                      </button>
                      <button
                        type="button"
                        disabled={busy || !email}
                        title={!email ? "Нет email владельца" : undefined}
                        onClick={() =>
                          void runAction("warn", { exchangerId: ex.id })
                        }
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink disabled:opacity-60"
                      >
                        Предупредить
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            !confirm(
                              `Снять «${ex.name}» с публикации и отправить письмо владельцу?`,
                            )
                          ) {
                            return;
                          }
                          void runAction("unpublish", {
                            exchangerId: ex.id,
                            notifyOwner: true,
                          });
                        }}
                        className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-60"
                      >
                        Снять + письмо
                      </button>
                      <Link
                        href={`${ADMIN_PATH}/exchangers/${encodeURIComponent(ex.id)}`}
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-accent"
                      >
                        Карточка →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
