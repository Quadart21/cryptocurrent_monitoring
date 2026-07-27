"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  StatusPill,
} from "@/components/admin/ui";
import type {
  EmailLogRow,
  EmailSettings,
  EmailTemplate,
} from "@/lib/email/types";

type TabId =
  | "overview"
  | "settings"
  | "templates"
  | "compose"
  | "log"
  | "smtp";

type Snapshot = {
  settings: EmailSettings;
  templates: EmailTemplate[];
  log: EmailLogRow[];
  smtpEnv: {
    hasApiKey: boolean;
    hasFromEnv: boolean;
    fromEnv: string | null;
    fromNameEnv: string | null;
  };
  siteUrl: string;
  siteName: string;
  templateVars: Record<string, string[]>;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "settings", label: "Настройки" },
  { id: "templates", label: "Шаблоны" },
  { id: "compose", label: "Отправка" },
  { id: "log", label: "Журнал" },
  { id: "smtp", label: "smtp.bz" },
];

const inputClass =
  "w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const areaClass = `${inputClass} min-h-[120px] resize-y font-mono text-xs`;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
      {children}
    </label>
  );
}

export function EmailModule() {
  const { busy, setBusy } = useAdmin();
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [tplId, setTplId] = useState("review_confirm");
  const [tplDraft, setTplDraft] = useState<EmailTemplate | null>(null);

  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeHtml, setComposeHtml] = useState(
    "<p>Здравствуйте!</p><p>Сообщение от GapSnap.</p>",
  );

  const [smtpJson, setSmtpJson] = useState<string>("");
  const [checkEmail, setCheckEmail] = useState("");
  const [unsubList, setUnsubList] = useState("");
  const [unsubRemove, setUnsubRemove] = useState("");
  const [msgFilters, setMsgFilters] = useState({
    to: "",
    tag: "",
    status: "",
    limit: "30",
  });

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/email?view=snapshot", {
      cache: "no-store",
    });
    if (!res.ok) {
      setError("Не удалось загрузить модуль email");
      return;
    }
    const json = (await res.json()) as Snapshot;
    setData(json);
    setSettings(json.settings);
    const first = json.templates[0];
    if (first) {
      setTplId(first.id);
      setTplDraft(first);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const found = data.templates.find((t) => t.id === tplId) ?? null;
    setTplDraft(found);
  }, [data, tplId]);

  const sentCount = useMemo(
    () => data?.log.filter((l) => l.status === "sent").length ?? 0,
    [data],
  );
  const failedCount = useMemo(
    () => data?.log.filter((l) => l.status === "failed").length ?? 0,
    [data],
  );

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
      const json = (await res.json()) as { settings?: EmailSettings; error?: string };
      if (!res.ok) throw new Error(json.error ?? "fail");
      if (json.settings) setSettings(json.settings);
      setOk("Настройки email сохранены");
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
      if (!res.ok) throw new Error(json.error ?? "fail");
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
    if (!confirm("Сбросить шаблон к заводскому?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset-template",
          template: { id: tplDraft.id },
        }),
      });
      if (!res.ok) throw new Error("fail");
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
            ? {
                action: "test",
                to: composeTo,
              }
            : {
                action: "send",
                to: composeTo,
                subject: composeSubject,
                html: composeHtml,
              },
        ),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "fail");
      setOk(kind === "test" ? "Тестовое письмо отправлено" : "Письмо отправлено");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }

  async function loadSmtp(view: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ view, ...extra });
      const res = await fetch(`/api/admin/email?${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "smtp error");
      setSmtpJson(JSON.stringify(json, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка smtp.bz");
      setSmtpJson("");
    } finally {
      setBusy(false);
    }
  }

  async function unsubAction(kind: "add" | "remove") {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "add"
            ? { action: "unsubscribe-add", addresses: unsubList }
            : { action: "unsubscribe-remove", address: unsubRemove },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "fail");
      setOk(kind === "add" ? "Адреса добавлены в отписку" : "Адрес удалён из отписки");
      setSmtpJson(JSON.stringify(json, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !settings) {
    return (
      <div className="text-sm text-ink-muted">
        {error ?? "Загрузка модуля email…"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Email"
        description="Шаблоны, рассылки, журнал и интеграция smtp.bz"
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setError(null);
              setOk(null);
            }}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              tab === t.id
                ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                : "border border-line text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {ok}
        </p>
      )}

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="API ключ" value={data.smtpEnv.hasApiKey ? "задан" : "нет"} ok={data.smtpEnv.hasApiKey} />
            <Stat label="From (env)" value={data.smtpEnv.fromEnv ?? "—"} ok={data.smtpEnv.hasFromEnv} />
            <Stat label="Отправлено (лог)" value={String(sentCount)} ok />
            <Stat label="Ошибки (лог)" value={String(failedCount)} ok={failedCount === 0} />
          </div>
          <AdminSection title="Активные уведомления">
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>
                Подтверждение отзыва:{" "}
                <strong className="text-ink">
                  {settings.notifyReviewConfirm ? "вкл" : "выкл"}
                </strong>
              </li>
              <li>
                Одобрение обменника → владельцу:{" "}
                <strong className="text-ink">
                  {settings.notifyOwnerExchangerApproved ? "вкл" : "выкл"}
                </strong>
              </li>
              <li>
                Новый отзыв → владельцу:{" "}
                <strong className="text-ink">
                  {settings.notifyOwnerReviewApproved ? "вкл" : "выкл"}
                </strong>
              </li>
              <li>
                SITE_URL: <code className="text-ink">{data.siteUrl}</code>
              </li>
            </ul>
          </AdminSection>
          <AdminSection title="Последние письма">
            <LogTable rows={data.log.slice(0, 8)} />
          </AdminSection>
        </div>
      )}

      {tab === "settings" && (
        <form onSubmit={(e) => void saveSettings(e)} className="space-y-4">
          <AdminSection title="Отправитель">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="From email"
                hint={`Пусто = ${data.smtpEnv.fromEnv ?? "SMTPBZ_FROM из .env"}`}
              >
                <input
                  className={inputClass}
                  value={settings.fromEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, fromEmail: e.target.value })
                  }
                  placeholder={data.smtpEnv.fromEnv ?? "noreply@gapsnap.org"}
                />
              </Field>
              <Field label="Имя отправителя">
                <input
                  className={inputClass}
                  value={settings.fromName}
                  onChange={(e) =>
                    setSettings({ ...settings, fromName: e.target.value })
                  }
                />
              </Field>
              <Field label="Reply-To" hint="Опционально">
                <input
                  className={inputClass}
                  value={settings.replyTo}
                  onChange={(e) =>
                    setSettings({ ...settings, replyTo: e.target.value })
                  }
                />
              </Field>
            </div>
          </AdminSection>
          <AdminSection title="Триггеры">
            <div className="space-y-3">
              <Toggle
                label="Письмо подтверждения отзыва автору"
                checked={settings.notifyReviewConfirm}
                onChange={(v) =>
                  setSettings({ ...settings, notifyReviewConfirm: v })
                }
              />
              <Toggle
                label="Письмо владельцу при одобрении обменника (доступ + 2FA)"
                checked={settings.notifyOwnerExchangerApproved}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    notifyOwnerExchangerApproved: v,
                  })
                }
              />
              <Toggle
                label="Письмо владельцу при публикации отзыва"
                checked={settings.notifyOwnerReviewApproved}
                onChange={(v) =>
                  setSettings({ ...settings, notifyOwnerReviewApproved: v })
                }
              />
            </div>
          </AdminSection>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Сохранить настройки
          </button>
        </form>
      )}

      {tab === "templates" && tplDraft && (
        <form onSubmit={(e) => void saveTemplate(e)} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {data.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTplId(t.id)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  tplId === t.id
                    ? "bg-accent/20 text-accent"
                    : "border border-line text-ink-muted"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <AdminSection title={tplDraft.name}>
            <p className="mb-3 text-xs text-ink-muted">{tplDraft.description}</p>
            <p className="mb-3 text-xs text-ink-muted">
              Переменные:{" "}
              {(data.templateVars[tplDraft.id] ?? [])
                .map((v) => `{{${v}}}`)
                .join(", ") || "—"}
            </p>
            <div className="grid gap-4">
              <Field label="Название">
                <input
                  className={inputClass}
                  value={tplDraft.name}
                  onChange={(e) =>
                    setTplDraft({ ...tplDraft, name: e.target.value })
                  }
                />
              </Field>
              <Toggle
                label="Шаблон включён"
                checked={tplDraft.enabled}
                onChange={(v) => setTplDraft({ ...tplDraft, enabled: v })}
              />
              <Field label="Тема">
                <input
                  className={inputClass}
                  value={tplDraft.subject}
                  onChange={(e) =>
                    setTplDraft({ ...tplDraft, subject: e.target.value })
                  }
                />
              </Field>
              <Field label="HTML">
                <textarea
                  className={areaClass}
                  rows={12}
                  value={tplDraft.html}
                  onChange={(e) =>
                    setTplDraft({ ...tplDraft, html: e.target.value })
                  }
                />
              </Field>
              <Field label="Текст (plain)">
                <textarea
                  className={areaClass}
                  rows={6}
                  value={tplDraft.text}
                  onChange={(e) =>
                    setTplDraft({ ...tplDraft, text: e.target.value })
                  }
                />
              </Field>
            </div>
          </AdminSection>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Сохранить шаблон
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void resetTemplate()}
              className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted"
            >
              Сбросить к умолчанию
            </button>
          </div>
        </form>
      )}

      {tab === "compose" && (
        <div className="space-y-4">
          <AdminSection title="Тест / ручная отправка">
            <div className="grid gap-4">
              <Field label="Кому">
                <input
                  className={inputClass}
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>
              <Field label="Тема (для ручной отправки)">
                <input
                  className={inputClass}
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </Field>
              <Field label="HTML">
                <textarea
                  className={areaClass}
                  rows={8}
                  value={composeHtml}
                  onChange={(e) => setComposeHtml(e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !composeTo}
                  onClick={() => void sendMail("test")}
                  className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  Тестовое письмо
                </button>
                <button
                  type="button"
                  disabled={busy || !composeTo || !composeSubject}
                  onClick={() => void sendMail("send")}
                  className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted disabled:opacity-60"
                >
                  Отправить как есть
                </button>
              </div>
            </div>
          </AdminSection>
        </div>
      )}

      {tab === "log" && (
        <AdminSection title="Локальный журнал отправок">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
              onClick={() => void load()}
            >
              Обновить
            </button>
          </div>
          <LogTable rows={data.log} />
        </AdminSection>
      )}

      {tab === "smtp" && (
        <div className="space-y-4">
          <AdminSection title="API smtp.bz">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                onClick={() => void loadSmtp("smtp-user")}
              >
                Профиль
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                onClick={() => void loadSmtp("smtp-stats")}
              >
                Статистика
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                onClick={() => void loadSmtp("smtp-domains")}
              >
                Домены
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                onClick={() =>
                  void loadSmtp("smtp-messages", {
                    limit: msgFilters.limit,
                    to: msgFilters.to,
                    tag: msgFilters.tag,
                    status: msgFilters.status,
                  })
                }
              >
                Журнал писем
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                className={inputClass}
                placeholder="filter to"
                value={msgFilters.to}
                onChange={(e) =>
                  setMsgFilters({ ...msgFilters, to: e.target.value })
                }
              />
              <input
                className={inputClass}
                placeholder="tag"
                value={msgFilters.tag}
                onChange={(e) =>
                  setMsgFilters({ ...msgFilters, tag: e.target.value })
                }
              />
              <input
                className={inputClass}
                placeholder="status: sent/bounce…"
                value={msgFilters.status}
                onChange={(e) =>
                  setMsgFilters({ ...msgFilters, status: e.target.value })
                }
              />
              <input
                className={inputClass}
                placeholder="limit"
                value={msgFilters.limit}
                onChange={(e) =>
                  setMsgFilters({ ...msgFilters, limit: e.target.value })
                }
              />
            </div>
          </AdminSection>

          <AdminSection title="Проверка email">
            <div className="flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-md`}
                value={checkEmail}
                onChange={(e) => setCheckEmail(e.target.value)}
                placeholder="user@example.com"
              />
              <button
                type="button"
                disabled={busy || !checkEmail}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                onClick={() =>
                  void loadSmtp("smtp-check", { email: checkEmail })
                }
              >
                Проверить
              </button>
            </div>
          </AdminSection>

          <AdminSection title="Отписки">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <textarea
                  className={areaClass}
                  rows={4}
                  placeholder={"addr1@mail.com\naddr2@mail.com"}
                  value={unsubList}
                  onChange={(e) => setUnsubList(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !unsubList.trim()}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                  onClick={() => void unsubAction("add")}
                >
                  Добавить в отписку
                </button>
              </div>
              <div className="space-y-2">
                <input
                  className={inputClass}
                  value={unsubRemove}
                  onChange={(e) => setUnsubRemove(e.target.value)}
                  placeholder="email для удаления"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !unsubRemove.trim()}
                    className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                    onClick={() => void unsubAction("remove")}
                  >
                    Удалить из отписки
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                    onClick={() => void loadSmtp("smtp-unsubscribe", { limit: "50" })}
                  >
                    Список отписок
                  </button>
                </div>
              </div>
            </div>
          </AdminSection>

          {smtpJson && (
            <AdminSection title="Ответ API">
              <pre className="max-h-[420px] overflow-auto rounded-2xl border border-line bg-bg-soft/50 p-4 text-xs text-ink">
                {smtpJson}
              </pre>
            </AdminSection>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-soft/40 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-semibold ${
          ok === false ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
      <span className="text-sm text-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

function LogTable({ rows }: { rows: EmailLogRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">Пока пусто</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
          <tr>
            <th className="px-2 py-2">Время</th>
            <th className="px-2 py-2">Кому</th>
            <th className="px-2 py-2">Тема</th>
            <th className="px-2 py-2">Тег</th>
            <th className="px-2 py-2">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line/60 align-top">
              <td className="px-2 py-2 whitespace-nowrap text-xs text-ink-muted">
                {new Date(r.createdAt).toLocaleString("ru-RU")}
              </td>
              <td className="px-2 py-2">{r.toAddress}</td>
              <td className="px-2 py-2 max-w-[240px] truncate">{r.subject}</td>
              <td className="px-2 py-2 text-xs text-ink-muted">{r.tag}</td>
              <td className="px-2 py-2">
                <StatusPill
                  status={
                    r.status === "sent"
                      ? "active"
                      : r.status === "failed"
                        ? "error"
                        : "pending"
                  }
                />
                {r.error ? (
                  <p className="mt-1 max-w-[200px] text-xs text-danger">
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
