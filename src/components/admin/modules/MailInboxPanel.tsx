"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminSection } from "@/components/admin/ui";

type Identity = { email: string; name: string };

type Thread = {
  id: string;
  contactEmail: string;
  contactName: string;
  subject: string;
  lastMessageAt: string;
  unreadCount: number;
  exchangerId: string | null;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  createdAt: string;
};

const inputClass =
  "w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FromSelect({
  identities,
  value,
  onChange,
}: {
  identities: Identity[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (identities.length === 0) return null;
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-ink-muted">От кого</span>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {identities.map((i) => (
          <option key={i.email} value={i.email}>
            {i.name} &lt;{i.email}&gt;
          </option>
        ))}
      </select>
    </label>
  );
}

export function MailInboxPanel() {
  const { busy, setBusy } = useAdmin();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [unread, setUnread] = useState(0);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [fromEmail, setFromEmail] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [providerHint, setProviderHint] = useState<string | null>(null);

  const pickFrom = useCallback(
    (suggested: string | null | undefined, list: Identity[]) => {
      const pool = list.length ? list : identities;
      if (!pool.length) return;
      const s = (suggested ?? "").trim().toLowerCase();
      const hit = pool.find((i) => i.email === s);
      setFromEmail(hit?.email ?? pool[0]!.email);
    },
    [identities],
  );

  const loadThreads = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/mailbox?view=threads", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as {
        threads?: Thread[];
        unread?: number;
        identities?: Identity[];
        provider?: {
          hasApiKey?: boolean;
          hasFromEnv?: boolean;
          hasWebhookSecret?: boolean;
          fromEnv?: string | null;
          identities?: Identity[];
        };
        error?: string;
      } | null;
      if (!res.ok) {
        setError(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      setThreads(json?.threads ?? []);
      setUnread(json?.unread ?? 0);
      const ids =
        json?.identities ?? json?.provider?.identities ?? [];
      setIdentities(ids);
      setFromEmail((prev) => {
        if (prev && ids.some((i) => i.email === prev)) return prev;
        return ids[0]?.email ?? prev;
      });
      const p = json?.provider;
      if (p) {
        const bits = [
          p.hasApiKey ? "API key OK" : "нет RESEND_API_KEY",
          p.hasFromEnv ? `from ${p.fromEnv}` : "нет RESEND_FROM",
          p.hasWebhookSecret ? "webhook secret OK" : "нет webhook secret",
        ];
        setProviderHint(bits.join(" · "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, []);

  const openThread = useCallback(async (id: string) => {
    setError(null);
    setOk(null);
    setComposing(false);
    setSelectedId(id);
    try {
      const res = await fetch(
        `/api/admin/mailbox?view=thread&id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => null)) as {
        thread?: Thread;
        messages?: Message[];
        identities?: Identity[];
        suggestedFrom?: string | null;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      setActiveThread(json?.thread ?? null);
      setMessages(json?.messages ?? []);
      setReply("");
      if (json?.identities?.length) setIdentities(json.identities);
      pickFrom(json?.suggestedFrom, json?.identities ?? []);
      setThreads((prev) => {
        const was = prev.find((t) => t.id === id)?.unreadCount ?? 0;
        if (was > 0) {
          setUnread((n) => Math.max(0, n - was));
        }
        return prev.map((t) =>
          t.id === id ? { ...t, unreadCount: 0 } : t,
        );
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }, [pickFrom]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          threadId: selectedId,
          text: reply,
          from: fromEmail,
        }),
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
      if (!res.ok) throw new Error(json.error ?? "Не удалось ответить");
      setOk("Ответ отправлен");
      setReply("");
      await openThread(selectedId);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendCompose() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compose",
          to: composeTo,
          subject: composeSubject,
          text: composeBody,
          from: fromEmail,
        }),
      });
      const raw = await res.text();
      let json: { error?: string; thread?: Thread } = {};
      try {
        json = raw
          ? (JSON.parse(raw) as { error?: string; thread?: Thread })
          : {};
      } catch {
        throw new Error(
          res.ok
            ? "Сервер вернул не JSON"
            : `Ошибка сервера (HTTP ${res.status})`,
        );
      }
      if (!res.ok) throw new Error(json.error ?? "Не удалось отправить");
      setOk("Письмо отправлено");
      setComposing(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      await loadThreads();
      if (json.thread?.id) await openThread(json.thread.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <AdminSection
        title="Входящие"
        description={
          providerHint
            ? `Resend · ${providerHint}`
            : "Письма клиентов через Resend inbound"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-sm text-ink-muted">
            {threads.length} диалогов
            {unread > 0 ? (
              <span className="ml-2 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">
                {unread} непрочит.
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setComposing(true);
                setSelectedId(null);
                setActiveThread(null);
                setMessages([]);
              }}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink"
            >
              Новое письмо
            </button>
            <button
              type="button"
              onClick={() => void loadThreads()}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink"
            >
              Обновить
            </button>
          </div>
        </div>

        {error ? (
          <p className="mx-5 mt-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="mx-5 mt-3 rounded-xl border border-ok/25 bg-ok/10 px-4 py-3 text-sm text-ok">
            {ok}
          </p>
        ) : null}

        <div className="grid min-h-[420px] md:grid-cols-[minmax(240px,320px)_1fr]">
          <div className="max-h-[520px] overflow-y-auto border-b border-line md:border-b-0 md:border-r">
            {threads.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">
                Пока нет писем. Настройте inbound в Resend на support@…
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {threads.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void openThread(t.id)}
                        className={`w-full px-4 py-3 text-left transition ${
                          active
                            ? "bg-accent/10"
                            : "hover:bg-bg-soft/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              t.unreadCount > 0
                                ? "font-semibold text-ink"
                                : "font-medium text-ink"
                            }`}
                          >
                            {t.contactName || t.contactEmail}
                          </span>
                          {t.unreadCount > 0 ? (
                            <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                              {t.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {t.subject || "(без темы)"}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-muted/80">
                          {formatWhen(t.lastMessageAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex min-h-[320px] flex-col">
            {composing ? (
              <div className="space-y-3 p-5">
                <p className="text-sm font-medium text-ink">Новое письмо</p>
                <FromSelect
                  identities={identities}
                  value={fromEmail}
                  onChange={setFromEmail}
                />
                <input
                  className={inputClass}
                  type="email"
                  placeholder="Кому"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Тема"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
                <textarea
                  className={`${inputClass} min-h-[140px] resize-y`}
                  placeholder="Текст письма (фирменный шаблон GapSnap добавится сам)"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setComposing(false)}
                    className="rounded-xl border border-line px-4 py-2 text-sm text-ink-muted"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy || !composeTo.trim() || !composeBody.trim()
                    }
                    onClick={() => void sendCompose()}
                    className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    Отправить
                  </button>
                </div>
              </div>
            ) : !activeThread ? (
              <p className="flex flex-1 items-center justify-center px-5 py-10 text-sm text-ink-muted">
                Выберите диалог слева
              </p>
            ) : (
              <>
                <div className="border-b border-line px-5 py-3">
                  <p className="text-sm font-semibold text-ink">
                    {activeThread.contactName || activeThread.contactEmail}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {activeThread.contactEmail}
                    {activeThread.exchangerId
                      ? ` · обменник ${activeThread.exchangerId}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {activeThread.subject}
                  </p>
                </div>
                <div className="max-h-[320px] flex-1 space-y-3 overflow-y-auto p-5">
                  {messages.map((m) => {
                    const mine = m.direction === "outbound";
                    return (
                      <div
                        key={m.id}
                        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          mine
                            ? "ml-auto bg-accent/15 text-ink"
                            : "mr-auto bg-bg-soft text-ink"
                        }`}
                      >
                        <p className="mb-1 text-[11px] text-ink-muted">
                          {mine
                            ? `Вы · ${m.fromAddress}`
                            : `${m.fromAddress} → ${m.toAddress}`}{" "}
                          · {formatWhen(m.createdAt)}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {m.textBody ||
                            (m.htmlBody
                              ? m.htmlBody.replace(/<[^>]+>/g, " ").trim()
                              : "(пусто)")}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 border-t border-line p-4">
                  <FromSelect
                    identities={identities}
                    value={fromEmail}
                    onChange={setFromEmail}
                  />
                  <textarea
                    className={`${inputClass} min-h-[88px] resize-y`}
                    placeholder="Ответ клиенту… (уйдёт в фирменном шаблоне GapSnap)"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy || !reply.trim()}
                      onClick={() => void sendReply()}
                      className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      Ответить
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
