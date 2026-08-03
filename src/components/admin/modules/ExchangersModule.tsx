"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { FeedExchangerStatus } from "@/lib/store-types";
import { formatOutboundCtr } from "@/lib/exchanger-traffic";
import { logoPublicUrl } from "@/lib/logo-url";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminPagination,
  AdminSection,
  StatusPill,
} from "@/components/admin/ui";

const PAGE_SIZE = 30;

const FILTERS: Array<{ id: "all" | FeedExchangerStatus; label: string }> = [
  { id: "all", label: "Все" },
  { id: "pending", label: "На проверке" },
  { id: "active", label: "Активные" },
  { id: "error", label: "Ошибки" },
  { id: "rejected", label: "Отклонённые" },
];

type InviteFilter = "all" | "pending" | "sent" | "noemail";

const INVITE_FILTERS: Array<{ id: InviteFilter; label: string }> = [
  { id: "all", label: "Приглашение: все" },
  { id: "pending", label: "Ещё не слали" },
  { id: "sent", label: "Отправлено" },
  { id: "noemail", label: "Нет email" },
];

function hasInviteEmail(ex: {
  contact: string;
  ownerEmail?: string | null;
}): boolean {
  return (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(ex.contact) ||
    Boolean(ex.ownerEmail && /@/.test(ex.ownerEmail))
  );
}

function inviteStatus(
  ex: {
    contact: string;
    ownerEmail?: string | null;
    inviteEmailSentAt?: string | null;
  },
): "sent" | "pending" | "noemail" {
  if (ex.inviteEmailSentAt) return "sent";
  if (hasInviteEmail(ex)) return "pending";
  return "noemail";
}

const EMPTY_FORM = {
  name: "",
  website: "",
  feedUrl: "",
  exchangeUrlTemplate: "",
  referralUrlTemplate: "",
  contact: "",
  description: "",
  ownerEmail: "",
  ownerLogin: "",
  activate: true,
  skipFeedCheck: false,
};

export function ExchangersModule() {
  const router = useRouter();
  const { overview, busy, setBusy, refresh, can } = useAdmin();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createWarning, setCreateWarning] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const canWrite = can("exchangers.write");

  const rows = useMemo(() => {
    let list = overview?.exchangers ?? [];
    if (filter !== "all") list = list.filter((e) => e.status === filter);
    if (inviteFilter !== "all") {
      list = list.filter((e) => inviteStatus(e) === inviteFilter);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(needle) ||
          e.slug.toLowerCase().includes(needle) ||
          e.feedUrl.toLowerCase().includes(needle) ||
          e.contact.toLowerCase().includes(needle) ||
          (e.inviteEmailTo || "").toLowerCase().includes(needle),
      );
    }
    return list;
  }, [overview, filter, inviteFilter, q]);

  const invitePendingCount = useMemo(() => {
    return (overview?.exchangers ?? []).filter(
      (e) => e.status === "active" && inviteStatus(e) === "pending",
    ).length;
  }, [overview]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  useEffect(() => {
    setPage(1);
  }, [filter, inviteFilter, q]);

  async function invitePendingAll() {
    if (!canWrite) return;
    if (
      !window.confirm(
        `Отправить приглашение ${invitePendingCount} обменникам без письма?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/exchangers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite-pending", limit: 100 }),
      });
      const data = (await res.json()) as {
        error?: string;
        sent?: number;
        failed?: number;
        skipped?: number;
        remaining?: number;
        pendingTotal?: number;
      };
      if (!res.ok) {
        setInviteMsg(data.error || "Не удалось отправить приглашения");
        return;
      }
      setInviteMsg(
        `Отправлено: ${data.sent ?? 0}, пропущено: ${data.skipped ?? 0}, ошибок: ${data.failed ?? 0}. Осталось без письма: ${data.remaining ?? 0}.`,
      );
      await refresh();
    } catch {
      setInviteMsg("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setCreateError(null);
    setCreateWarning(null);
    try {
      const res = await fetch("/api/admin/exchangers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          website: form.website.trim(),
          feedUrl: form.feedUrl.trim(),
          exchangeUrlTemplate: form.exchangeUrlTemplate.trim(),
          referralUrlTemplate: form.referralUrlTemplate.trim(),
          contact: form.contact.trim(),
          description: form.description.trim(),
          ownerEmail: form.ownerEmail.trim() || undefined,
          ownerLogin: form.ownerLogin.trim() || undefined,
          status: form.activate ? "active" : "pending",
          skipFeedCheck: form.skipFeedCheck,
          sync: form.activate && !form.skipFeedCheck,
        }),
      });
      let data: {
        error?: string;
        feedWarning?: string | null;
        exchanger?: { id: string };
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw new Error(
          res.status === 504 || res.status === 502
            ? "Сервер не успел обработать крупный XML-фид. Включите «Не проверять фид сейчас» или повторите."
            : `Ошибка сервера (HTTP ${res.status})`,
        );
      }
      if (!res.ok) throw new Error(data.error ?? "Не удалось создать");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      if (data.feedWarning) setCreateWarning(data.feedWarning);
      await refresh();
      if (data.exchanger?.id) {
        router.push(
          `${ADMIN_PATH}/exchangers/${encodeURIComponent(data.exchanger.id)}`,
        );
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Обменники"
        description="Добавьте обменник вручную или откройте карточку, чтобы править данные, ачивки и смотреть трафик."
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              {invitePendingCount > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void invitePendingAll()}
                  className="rounded-2xl bg-accent/15 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60"
                >
                  Пригласить без письма ({invitePendingCount})
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowCreate((v) => !v);
                  setCreateError(null);
                }}
                className="rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-bg-soft"
              >
                {showCreate ? "Скрыть форму" : "Добавить вручную"}
              </button>
            </div>
          ) : null
        }
      />

      {inviteMsg ? (
        <p className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-deep">
          {inviteMsg}
        </p>
      ) : null}

      {createWarning ? (
        <p className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-deep">
          {createWarning}
        </p>
      ) : null}

      {showCreate && canWrite ? (
        <AdminSection title="Новый обменник">
          <form
            onSubmit={(e) => void onCreate(e)}
            className="grid gap-4 p-5 sm:grid-cols-2"
          >
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Название *
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                placeholder="Kubex"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Сайт *
              </span>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                required
                placeholder="https://example.com"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                XML-фид *
              </span>
              <input
                value={form.feedUrl}
                onChange={(e) => setForm({ ...form, feedUrl: e.target.value })}
                required
                placeholder="https://example.com/rates.xml"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Шаблон ссылки на обмен
              </span>
              <input
                value={form.exchangeUrlTemplate}
                onChange={(e) =>
                  setForm({ ...form, exchangeUrlTemplate: e.target.value })
                }
                placeholder="https://example.com/exchange/{0}/{1}"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <span className="block text-xs text-ink-muted">
                {"{0}"} — отдаёте, {"{1}"} — получаете. Можно заполнить позже.
              </span>
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Реферальная ссылка GapSnap
              </span>
              <input
                value={form.referralUrlTemplate}
                onChange={(e) =>
                  setForm({ ...form, referralUrlTemplate: e.target.value })
                }
                placeholder="https://example.com/?ref=gapsnap"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <span className="block text-xs text-ink-muted">
                Партнёрская ссылка мониторинга (приоритет над шаблоном обмена).
                Можно добавить позже.
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Контакт
              </span>
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="email@ или @telegram"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Email владельца
              </span>
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(e) =>
                  setForm({ ...form, ownerEmail: e.target.value })
                }
                placeholder="owner@example.com"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Логин кабинета
              </span>
              <input
                value={form.ownerLogin}
                onChange={(e) =>
                  setForm({ ...form, ownerLogin: e.target.value })
                }
                placeholder="my_exchanger"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Описание
              </span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                placeholder="Кратко: специализация, регионы"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
              <input
                type="checkbox"
                checked={form.activate}
                onChange={(e) =>
                  setForm({ ...form, activate: e.target.checked })
                }
                className="mt-1"
              />
              <span>
                Сразу активировать и синхронизировать курсы
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Иначе статус «на проверке» — как после публичной заявки.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
              <input
                type="checkbox"
                checked={form.skipFeedCheck}
                onChange={(e) =>
                  setForm({ ...form, skipFeedCheck: e.target.checked })
                }
                className="mt-1"
              />
              <span>
                Не проверять XML сейчас
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Если URL известен, но фид временно недоступен.
                </span>
              </span>
            </label>

            {createError ? (
              <p className="rounded-2xl border border-danger/30 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-danger sm:col-span-2">
                {createError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Создаём…" : "Создать обменник"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
                className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted"
              >
                Отмена
              </button>
            </div>
          </form>
        </AdminSection>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск: имя, slug, фид, контакт"
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
        <div className="flex flex-wrap gap-2">
          {INVITE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setInviteFilter(f.id)}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                inviteFilter === f.id
                  ? "bg-ok/15 text-ok ring-1 ring-ok/30"
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
            <p className="px-5 py-6 text-sm text-ink-muted">
              Ничего не найдено
              {canWrite && !showCreate ? (
                <>
                  {" "}
                  —{" "}
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="font-semibold text-accent underline underline-offset-2"
                  >
                    добавить вручную
                  </button>
                </>
              ) : null}
            </p>
          ) : (
            paginatedRows.map((ex) => {
              const logoSrc = logoPublicUrl(ex.id, ex.logo);
              const inv = inviteStatus(ex);
              return (
                <Link
                  key={ex.id}
                  href={`${ADMIN_PATH}/exchangers/${encodeURIComponent(ex.id)}`}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-accent-soft/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoSrc}
                        alt=""
                        className="size-11 rounded-2xl bg-bg-soft object-contain"
                      />
                    ) : (
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/20 text-sm font-bold text-accent">
                        {ex.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{ex.name}</p>
                        <StatusPill status={ex.status} />
                        {ex.verified ? <StatusPill status="verified" /> : null}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            inv === "sent"
                              ? "bg-ok/15 text-ok"
                              : inv === "pending"
                                ? "bg-warn/15 text-warn"
                                : "bg-ink-muted/10 text-ink-muted"
                          }`}
                        >
                          {inv === "sent"
                            ? "Приглашён"
                            : inv === "pending"
                              ? "Без письма"
                              : "Нет email"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-muted">
                        {ex.slug} · {ex.pairCount} пар · ★{" "}
                        {ex.reviews === 0
                          ? "нет отзывов"
                          : `${ex.rating.toFixed(2).replace(".", ",")} (${ex.reviews})`}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Просмотры {ex.traffic?.pageViews ?? 0} · Переходы{" "}
                        {ex.traffic?.siteClicks ?? 0} · конверсия{" "}
                        {formatOutboundCtr(
                          ex.traffic ?? { pageViews: 0, siteClicks: 0 },
                        )}
                      </p>
                      {inv === "sent" ? (
                        <p className="mt-1 text-xs text-ok">
                          Письмо{" "}
                          {ex.inviteEmailSentAt
                            ? new Date(ex.inviteEmailSentAt).toLocaleDateString(
                                "ru-RU",
                              )
                            : ""}
                          {ex.inviteEmailTo ? ` → ${ex.inviteEmailTo}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-accent sm:shrink-0">
                    Открыть →
                  </span>
                </Link>
              );
            })
          )}
        </div>
        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
        />
      </AdminSection>
    </div>
  );
}
