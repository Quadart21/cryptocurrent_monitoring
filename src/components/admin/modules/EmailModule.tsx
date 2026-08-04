"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatGrid,
  AdminTabBar,
} from "@/components/admin/ui";
import type {
  BroadcastSegment,
  EmailContact,
} from "@/lib/email/types";
import type {
  EmailLogRow,
  EmailSettings,
  EmailTemplate,
} from "@/lib/email/types";
import { defaultComposeHtml } from "@/lib/email/layout";
import { MailInboxPanel } from "@/components/admin/modules/MailInboxPanel";

type TabId =
  | "inbox"
  | "overview"
  | "contacts"
  | "broadcast"
  | "settings"
  | "templates"
  | "compose"
  | "log";

type ContactStats = {
  total: number;
  active: number;
  exchangers: number;
  reviewers: number;
  unsubscribed: number;
};

type Snapshot = {
  settings: EmailSettings;
  templates: EmailTemplate[];
  log: EmailLogRow[];
  contacts: EmailContact[];
  contactStats: ContactStats;
  smtpEnv: {
    provider?: string;
    hasApiKey: boolean;
    hasFromEnv: boolean;
    fromEnv: string | null;
    fromNameEnv: string | null;
    hasWebhookSecret?: boolean;
  };
  siteUrl: string;
  siteName: string;
  templateVars: Record<string, string[]>;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "inbox", label: "Входящие" },
  { id: "overview", label: "Обзор" },
  { id: "contacts", label: "Контакты" },
  { id: "broadcast", label: "Рассылка" },
  { id: "settings", label: "Настройки" },
  { id: "templates", label: "Шаблоны" },
  { id: "compose", label: "Одно письмо" },
  { id: "log", label: "Журнал" },
];

const SEGMENTS: Array<{ id: BroadcastSegment; label: string; hint: string }> = [
  {
    id: "exchangers",
    label: "Обменники",
    hint: "Email владельцев из заявок",
  },
  {
    id: "reviewers",
    label: "Авторы отзывов",
    hint: "Email тех, кто оставил отзыв",
  },
  { id: "all", label: "Все", hint: "Обменники и авторы отзывов" },
];

const SOURCE_LABEL: Record<string, string> = {
  exchanger: "Обменник",
  review: "Отзыв",
  manual: "Вручную",
};

const inputClass =
  "w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15";
const areaClass = `${inputClass} min-h-[120px] resize-y font-mono text-[13px] leading-relaxed`;

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-xl border border-line bg-bg-soft/30 px-4 py-3.5 text-left transition hover:border-accent/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
        ) : null}
      </span>
      <span
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function LogStatus({ status }: { status: EmailLogRow["status"] }) {
  const map = {
    sent: { label: "Отправлено", className: "bg-ok/15 text-ok" },
    failed: { label: "Ошибка", className: "bg-danger/15 text-danger" },
    skipped: { label: "Пропущено", className: "bg-bg-soft text-ink-muted" },
  } as const;
  const item = map[status] ?? map.skipped;
  return (
    <span
      className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function LogTable({ rows }: { rows: EmailLogRow[] }) {
  if (!rows.length) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-muted">
        Пока нет отправок
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-bg-soft/50 text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            <th className="px-5 py-3 font-medium">Время</th>
            <th className="px-5 py-3 font-medium">Кому</th>
            <th className="px-5 py-3 font-medium">Тема</th>
            <th className="px-5 py-3 font-medium">Тег</th>
            <th className="px-5 py-3 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-line/70 align-top last:border-0"
            >
              <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-muted">
                {new Date(r.createdAt).toLocaleString("ru-RU")}
              </td>
              <td className="px-5 py-3 font-medium text-ink">{r.toAddress}</td>
              <td className="max-w-[260px] truncate px-5 py-3 text-ink-muted">
                {r.subject}
              </td>
              <td className="px-5 py-3 text-xs text-ink-muted">{r.tag || "—"}</td>
              <td className="px-5 py-3">
                <LogStatus status={r.status} />
                {r.error ? (
                  <p className="mt-1.5 max-w-[220px] text-xs leading-snug text-danger">
                    {r.error}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceBadges({ sources }: { sources: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((s) => (
        <span
          key={s}
          className="rounded-md bg-bg-soft px-1.5 py-0.5 text-[11px] font-medium text-ink-muted"
        >
          {SOURCE_LABEL[s] ?? s}
        </span>
      ))}
    </div>
  );
}

export function EmailModule() {
  const { busy, setBusy } = useAdmin();
  const [tab, setTab] = useState<TabId>("inbox");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [tplId, setTplId] = useState("review_confirm");
  const [tplDraft, setTplDraft] = useState<EmailTemplate | null>(null);

  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeHtml, setComposeHtml] = useState(() =>
    defaultComposeHtml("compose"),
  );

  const [contactQ, setContactQ] = useState("");
  const [contactFilter, setContactFilter] = useState<
    "all" | "exchangers" | "reviewers" | "unsubscribed"
  >("all");

  const [broadcastSegment, setBroadcastSegment] =
    useState<BroadcastSegment>("exchangers");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastHtml, setBroadcastHtml] = useState(() =>
    defaultComposeHtml("broadcast"),
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/email?view=snapshot", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | (Snapshot & { error?: string })
        | null;
      if (!res.ok) {
        setError(
          json?.error
            ? `Не удалось загрузить модуль: ${json.error}`
            : `Не удалось загрузить модуль (HTTP ${res.status})`,
        );
        return;
      }
      if (!json?.settings) {
        setError("Пустой ответ сервера");
        return;
      }
      setData({
        ...json,
        contacts: json.contacts ?? [],
        contactStats: json.contactStats ?? {
          total: 0,
          active: 0,
          exchangers: 0,
          reviewers: 0,
          unsubscribed: 0,
        },
      });
      setSettings(json.settings);
      const first = json.templates?.[0];
      if (first) {
        setTplId(first.id);
        setTplDraft(first);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    setTplDraft(data.templates.find((t) => t.id === tplId) ?? null);
  }, [data, tplId]);

  const sentCount = useMemo(
    () => data?.log.filter((l) => l.status === "sent").length ?? 0,
    [data],
  );
  const failedCount = useMemo(
    () => data?.log.filter((l) => l.status === "failed").length ?? 0,
    [data],
  );

  const filteredContacts = useMemo(() => {
    if (!data) return [];
    const needle = contactQ.trim().toLowerCase();
    return data.contacts.filter((c) => {
      if (contactFilter === "exchangers" && !c.sources.includes("exchanger")) {
        return false;
      }
      if (contactFilter === "reviewers" && !c.sources.includes("review")) {
        return false;
      }
      if (contactFilter === "unsubscribed") return c.unsubscribed;
      if (!needle) return true;
      return (
        c.email.includes(needle) ||
        c.label.toLowerCase().includes(needle) ||
        c.sources.some((s) =>
          (SOURCE_LABEL[s] ?? s).toLowerCase().includes(needle),
        )
      );
    });
  }, [data, contactQ, contactFilter]);

  const broadcastAudience = useMemo(() => {
    if (!data) return 0;
    return data.contacts.filter((c) => {
      if (c.unsubscribed) return false;
      if (broadcastSegment === "all") return true;
      if (broadcastSegment === "exchangers") {
        return c.sources.includes("exchanger");
      }
      return c.sources.includes("review");
    }).length;
  }, [data, broadcastSegment]);

  function switchTab(id: TabId) {
    setTab(id);
    setError(null);
    setOk(null);
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settings", settings }),
      });
      const json = (await res.json()) as {
        settings?: EmailSettings;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Ошибка сохранения");
      if (json.settings) setSettings(json.settings);
      setOk("Настройки сохранены");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate(e: FormEvent) {
    e.preventDefault();
    if (!tplDraft) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "template",
          template: {
            id: tplDraft.id,
            name: tplDraft.name,
            description: tplDraft.description,
            subject: tplDraft.subject,
            html: tplDraft.html,
            text: tplDraft.text,
            enabled: tplDraft.enabled,
          },
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Ошибка");
      setOk("Шаблон сохранён");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function resetTemplate() {
    if (!tplDraft) return;
    if (!confirm("Сбросить шаблон к заводскому виду?")) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset-template",
          template: { id: tplDraft.id },
        }),
      });
      if (!res.ok) throw new Error("Не удалось сбросить");
      setOk("Шаблон сброшен");
      await load();
    } catch {
      setError("Не удалось сбросить шаблон");
    } finally {
      setBusy(false);
    }
  }

  async function sendMail(kind: "test" | "send") {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "test"
            ? { action: "test", to: composeTo }
            : {
                action: "send",
                to: composeTo,
                subject: composeSubject,
                html: composeHtml,
              },
        ),
      });
      const raw = await res.text();
      let json: { error?: string } = {};
      try {
        json = raw ? (JSON.parse(raw) as { error?: string }) : {};
      } catch {
        throw new Error(
          res.ok
            ? "Сервер вернул не JSON"
            : `Ошибка сервера (HTTP ${res.status})`,
        );
      }
      if (!res.ok) throw new Error(json.error ?? "Ошибка отправки");
      setOk(kind === "test" ? "Тестовое письмо отправлено" : "Письмо отправлено");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }

  async function syncContacts() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-contacts" }),
      });
      const json = (await res.json()) as {
        error?: string;
        stats?: { exchangers: number; reviews: number; total: number };
      };
      if (!res.ok) throw new Error(json.error ?? "Ошибка синхронизации");
      setOk(
        `Синхронизировано: ${json.stats?.exchangers ?? 0} обменников, ${json.stats?.reviews ?? 0} отзывов → ${json.stats?.total ?? 0} контактов`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка синхронизации");
    } finally {
      setBusy(false);
    }
  }

  async function toggleUnsubscribe(email: string, unsubscribed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "contact-unsubscribe",
          email,
          unsubscribed,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Ошибка");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendBroadcast() {
    if (
      !confirm(
        `Отправить рассылку ${broadcastAudience} получателям?\nСегмент: ${SEGMENTS.find((s) => s.id === broadcastSegment)?.label}`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "broadcast",
          segment: broadcastSegment,
          subject: broadcastSubject,
          html: broadcastHtml,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        result?: { audience: number; sent: number; failed: number };
      };
      if (!res.ok) throw new Error(json.error ?? "Ошибка рассылки");
      setOk(
        `Рассылка завершена: ${json.result?.sent ?? 0} отправлено, ${json.result?.failed ?? 0} ошибок (аудитория ${json.result?.audience ?? 0})`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка рассылки");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !settings) {
    return (
      <div className="rounded-2xl border border-line bg-bg-soft/40 px-5 py-8 text-center text-sm text-ink-muted">
        {error ?? "Загрузка модуля…"}
      </div>
    );
  }

  const stats = data.contactStats;
  const tplVars = (data.templateVars[tplDraft?.id ?? ""] ?? []).map(
    (v) => `{{${v}}}`,
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Почта"
        description="Входящие через Resend, контакты, шаблоны и рассылки"
      />

      <AdminTabBar value={tab} onChange={switchTab} tabs={TABS} />

      {error ? (
        <p className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-ok/25 bg-ok/10 px-4 py-3 text-sm text-ok">
          {ok}
        </p>
      ) : null}

      {tab === "inbox" && <MailInboxPanel />}

      {tab === "overview" && (
        <div className="space-y-4">
          <AdminStatGrid
            items={[
              {
                label: "Resend API",
                value: data.smtpEnv.hasApiKey ? "Задан" : "Нет",
                tone: data.smtpEnv.hasApiKey ? "ok" : "warn",
              },
              { label: "Контакты", value: stats.active, tone: "ok" },
              { label: "Обменники", value: stats.exchangers },
              { label: "Авторы отзывов", value: stats.reviewers },
            ]}
          />
          <AdminStatGrid
            items={[
              { label: "Отправлено", value: sentCount, tone: "ok" },
              {
                label: "Ошибки",
                value: failedCount,
                tone: failedCount > 0 ? "warn" : undefined,
              },
              { label: "Отписаны", value: stats.unsubscribed },
              { label: "Шаблоны", value: data.templates.length },
            ]}
          />

          <AdminSection
            title="Уведомления"
            description={`Сайт: ${data.siteUrl}`}
          >
            <ul className="divide-y divide-line">
              {[
                ["Подтверждение отзыва", settings.notifyReviewConfirm],
                [
                  "Одобрение обменника → владельцу",
                  settings.notifyOwnerExchangerApproved,
                ],
                [
                  "Новый отзыв → владельцу",
                  settings.notifyOwnerReviewApproved,
                ],
                [
                  "Ответ в треде → автору",
                  settings.notifyReviewThreadAuthor,
                ],
                [
                  "Ответ автора → владельцу",
                  settings.notifyReviewThreadOwner,
                ],
                [
                  "Подтверждение жалобы",
                  settings.notifyComplaintConfirm,
                ],
                [
                  "API-ключ одобрен",
                  settings.notifyApiKeyApproved,
                ],
                [
                  "Приглашение обменника",
                  settings.notifyExchangerInvite,
                ],
              ].map(([label, on]) => (
                <li
                  key={String(label)}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm"
                >
                  <span className="text-ink-muted">{label}</span>
                  <span
                    className={`font-semibold ${on ? "text-ok" : "text-ink-muted"}`}
                  >
                    {on ? "Вкл" : "Выкл"}
                  </span>
                </li>
              ))}
            </ul>
          </AdminSection>

          <AdminSection title="Последние письма">
            <LogTable rows={data.log.slice(0, 8)} />
          </AdminSection>
        </div>
      )}

      {tab === "contacts" && (
        <div className="space-y-4">
          <AdminSection
            title="База контактов"
            description="Собирается из email владельцев обменников и авторов отзывов"
          >
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <input
                className={`${inputClass} sm:max-w-sm`}
                value={contactQ}
                onChange={(e) => setContactQ(e.target.value)}
                placeholder="Поиск по email или названию"
              />
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "Все"],
                    ["exchangers", "Обменники"],
                    ["reviewers", "Отзывы"],
                    ["unsubscribed", "Отписаны"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setContactFilter(id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      contactFilter === id
                        ? "bg-accent text-white"
                        : "border border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void syncContacts()}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
                >
                  Синхронизировать
                </button>
              </div>
            </div>

            {filteredContacts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">
                Контактов нет. Нажмите «Синхронизировать» или дождитесь новых
                заявок и отзывов.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-bg-soft/50 text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Метка</th>
                      <th className="px-5 py-3 font-medium">Источники</th>
                      <th className="px-5 py-3 font-medium">Статус</th>
                      <th className="px-5 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((c) => (
                      <tr
                        key={c.email}
                        className="border-b border-line/70 last:border-0"
                      >
                        <td className="px-5 py-3 font-medium text-ink">
                          {c.email}
                        </td>
                        <td className="px-5 py-3 text-ink-muted">
                          {c.label || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <SourceBadges sources={c.sources} />
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {c.unsubscribed ? (
                            <span className="text-ink-muted">Отписан</span>
                          ) : (
                            <span className="text-ok">Активен</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void toggleUnsubscribe(c.email, !c.unsubscribed)
                            }
                            className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
                          >
                            {c.unsubscribed ? "Вернуть" : "Отписать"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSection>
        </div>
      )}

      {tab === "broadcast" && (
        <AdminSection
          title="Рассылка"
          description="Письмо уйдёт всем активным контактам выбранного сегмента"
        >
          <div className="space-y-4 p-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink">Аудитория</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBroadcastSegment(s.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      broadcastSegment === s.id
                        ? "border-accent bg-accent/10"
                        : "border-line hover:border-accent/40"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-ink">
                      {s.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {s.hint}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                Получателей:{" "}
                <strong className="text-ink">{broadcastAudience}</strong>
              </p>
            </div>

            <Field label="Тема">
              <input
                className={inputClass}
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                placeholder="Тема рассылки"
              />
            </Field>
            <Field
              label="Текст письма"
              hint="Пишите только тело — баннер, кнопка и подвал GapSnap добавятся сами"
            >
              <textarea
                className={areaClass}
                rows={10}
                value={broadcastHtml}
                onChange={(e) => setBroadcastHtml(e.target.value)}
              />
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={
                  busy ||
                  !broadcastSubject.trim() ||
                  !broadcastHtml.trim() ||
                  broadcastAudience === 0
                }
                onClick={() => void sendBroadcast()}
                className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                Отправить рассылку
              </button>
            </div>
          </div>
        </AdminSection>
      )}

      {tab === "settings" && (
        <form onSubmit={(e) => void saveSettings(e)} className="space-y-4">
          <AdminSection
            title="Отправитель"
            description="Если поле пустое — берётся значение из .env"
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label="Email отправителя"
                hint={`По умолчанию: ${data.smtpEnv.fromEnv ?? "RESEND_FROM"}`}
              >
                <input
                  className={inputClass}
                  type="email"
                  autoComplete="off"
                  value={settings.fromEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, fromEmail: e.target.value })
                  }
                  placeholder={data.smtpEnv.fromEnv ?? "support@gapsnap.org"}
                />
              </Field>
              <Field label="Имя отправителя">
                <input
                  className={inputClass}
                  value={settings.fromName}
                  onChange={(e) =>
                    setSettings({ ...settings, fromName: e.target.value })
                  }
                  placeholder="GapSnap"
                />
              </Field>
              <Field
                label="Reply-To"
                hint="Необязательно"
                className="sm:col-span-2"
              >
                <input
                  className={inputClass}
                  type="email"
                  value={settings.replyTo}
                  onChange={(e) =>
                    setSettings({ ...settings, replyTo: e.target.value })
                  }
                  placeholder="support@gapsnap.org"
                />
              </Field>
            </div>
          </AdminSection>

          <AdminSection
            title="Автоматические письма"
            description="Какие события отправляют письма"
          >
            <div className="space-y-2.5 p-5">
              <Toggle
                label="Подтверждение отзыва"
                hint="Автору отзыва приходит ссылка для подтверждения email"
                checked={settings.notifyReviewConfirm}
                onChange={(v) =>
                  setSettings({ ...settings, notifyReviewConfirm: v })
                }
              />
              <Toggle
                label="Одобрение обменника"
                hint="Владельцу — доступ в кабинет и код 2FA"
                checked={settings.notifyOwnerExchangerApproved}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    notifyOwnerExchangerApproved: v,
                  })
                }
              />
              <Toggle
                label="Публикация отзыва"
                hint="Владельцу — уведомление о новом опубликованном отзыве"
                checked={settings.notifyOwnerReviewApproved}
                onChange={(v) =>
                  setSettings({ ...settings, notifyOwnerReviewApproved: v })
                }
              />
              <Toggle
                label="Ответ в треде → автору"
                hint="Автору отзыва — письмо со ссылкой «Ответить»"
                checked={settings.notifyReviewThreadAuthor}
                onChange={(v) =>
                  setSettings({ ...settings, notifyReviewThreadAuthor: v })
                }
              />
              <Toggle
                label="Ответ автора → владельцу"
                hint="Владельцу — когда автор ответил в треде"
                checked={settings.notifyReviewThreadOwner}
                onChange={(v) =>
                  setSettings({ ...settings, notifyReviewThreadOwner: v })
                }
              />
              <Toggle
                label="Подтверждение жалобы"
                hint="Автору жалобы — ссылка для подтверждения email"
                checked={settings.notifyComplaintConfirm}
                onChange={(v) =>
                  setSettings({ ...settings, notifyComplaintConfirm: v })
                }
              />
              <Toggle
                label="API-ключ одобрен"
                hint="Заявителю — выданный ключ доступа к /v2"
                checked={settings.notifyApiKeyApproved}
                onChange={(v) =>
                  setSettings({ ...settings, notifyApiKeyApproved: v })
                }
              />
              <Toggle
                label="Приглашение обменника"
                hint="Ручная/массовая рассылка знакомства из раздела Обменники"
                checked={settings.notifyExchangerInvite}
                onChange={(v) =>
                  setSettings({ ...settings, notifyExchangerInvite: v })
                }
              />
            </div>
          </AdminSection>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Сохранить
            </button>
          </div>
        </form>
      )}

      {tab === "templates" && tplDraft && (
        <form onSubmit={(e) => void saveTemplate(e)} className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {data.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTplId(t.id)}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  tplId === t.id
                    ? "bg-accent text-white"
                    : "border border-line text-ink-muted hover:border-accent/40 hover:text-ink"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <AdminSection
            title={tplDraft.name}
            description={tplDraft.description}
          >
            <div className="space-y-4 p-5">
              {tplVars.length > 0 ? (
                <div className="rounded-xl border border-line bg-bg-soft/40 px-3.5 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                    Переменные
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tplVars.map((v) => (
                      <code
                        key={v}
                        className="rounded-md bg-bg-elevated px-2 py-0.5 text-[12px] text-accent"
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Название в админке">
                  <input
                    className={inputClass}
                    value={tplDraft.name}
                    onChange={(e) =>
                      setTplDraft({ ...tplDraft, name: e.target.value })
                    }
                  />
                </Field>
                <div className="flex items-end">
                  <Toggle
                    label="Шаблон включён"
                    checked={tplDraft.enabled}
                    onChange={(v) => setTplDraft({ ...tplDraft, enabled: v })}
                  />
                </div>
              </div>

              <Field label="Тема письма">
                <input
                  className={inputClass}
                  value={tplDraft.subject}
                  onChange={(e) =>
                    setTplDraft({ ...tplDraft, subject: e.target.value })
                  }
                />
              </Field>
              <Field label="HTML" hint="Можно использовать переменные выше">
                <textarea
                  className={areaClass}
                  rows={12}
                  value={tplDraft.html}
                  onChange={(e) =>
                    setTplDraft({ ...tplDraft, html: e.target.value })
                  }
                />
              </Field>
              <Field label="Текстовая версия">
                <textarea
                  className={`${areaClass} min-h-[96px]`}
                  rows={5}
                  value={tplDraft.text}
                  onChange={(e) =>
                    setTplDraft({ ...tplDraft, text: e.target.value })
                  }
                />
              </Field>
            </div>
          </AdminSection>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void resetTemplate()}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
            >
              Сбросить
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Сохранить шаблон
            </button>
          </div>
        </form>
      )}

      {tab === "compose" && (
        <AdminSection
          title="Одно письмо"
          description="Тест Resend или ручная отправка одному адресу"
        >
          <div className="space-y-4 p-5">
            <Field label="Кому">
              <input
                className={inputClass}
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Тема" hint="Нужна только для ручной отправки">
              <input
                className={inputClass}
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Тема письма"
              />
            </Field>
            <Field
              label="Текст письма"
              hint="Пишите только тело — баннер, кнопка и подвал GapSnap добавятся сами"
            >
              <textarea
                className={areaClass}
                rows={8}
                value={composeHtml}
                onChange={(e) => setComposeHtml(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy || !composeTo}
                onClick={() => void sendMail("test")}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
              >
                Тестовое письмо
              </button>
              <button
                type="button"
                disabled={busy || !composeTo || !composeSubject}
                onClick={() => void sendMail("send")}
                className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                Отправить
              </button>
            </div>
          </div>
        </AdminSection>
      )}

      {tab === "log" && (
        <AdminSection title="Журнал отправок">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <p className="text-sm text-ink-muted">
              {data.log.length} записей в журнале
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink"
            >
              Обновить
            </button>
          </div>
          <LogTable rows={data.log} />
        </AdminSection>
      )}
    </div>
  );
}
