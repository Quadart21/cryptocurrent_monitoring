"use client";

import type {
  FormEvent,
  ReactNode,
  RefObject,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatGrid,
  AdminTabBar,
} from "@/components/admin/ui";
import type {
  TelegramConnectionInfo,
  TelegramParseMode,
  TelegramPost,
  TelegramSettingsPublic,
} from "@/lib/telegram/types";

type TabId = "compose" | "history" | "settings";

type Snapshot = {
  settings: TelegramSettingsPublic;
  posts: TelegramPost[];
  env: { hasBotToken: boolean; hasChannelId: boolean };
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "compose", label: "Написать" },
  { id: "history", label: "Журнал" },
  { id: "settings", label: "Настройки" },
];

const PARSE_MODES: Array<{ id: TelegramParseMode; label: string }> = [
  { id: "HTML", label: "HTML" },
  { id: "MarkdownV2", label: "MarkdownV2" },
  { id: "Markdown", label: "Markdown" },
];

const inputClass =
  "w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15";
const areaClass = `${inputClass} min-h-[160px] resize-y font-mono text-[13px] leading-relaxed`;

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

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "текст",
): { next: string; start: number; end: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const selStart = start + before.length;
  const selEnd = selStart + selected.length;
  return { next, start: selStart, end: selEnd };
}

function FormatToolbar({
  textareaRef,
  parseMode,
  value,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  parseMode: TelegramParseMode;
  value: string;
  onChange: (next: string) => void;
}) {
  const apply = (before: string, after: string, placeholder?: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const result = wrapSelection(el, before, after, placeholder);
    onChange(result.next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  };

  if (parseMode !== "HTML") {
    return (
      <p className="text-xs text-ink-muted">
        Панель форматирования доступна для HTML. Для Markdown размечайте вручную.
      </p>
    );
  }

  const buttons: Array<{ label: string; title: string; run: () => void }> = [
    { label: "B", title: "Жирный", run: () => apply("<b>", "</b>") },
    { label: "I", title: "Курсив", run: () => apply("<i>", "</i>") },
    { label: "U", title: "Подчёркнутый", run: () => apply("<u>", "</u>") },
    { label: "S", title: "Зачёркнутый", run: () => apply("<s>", "</s>") },
    { label: "</>", title: "Код", run: () => apply("<code>", "</code>", "code") },
    {
      label: "pre",
      title: "Блок кода",
      run: () => apply("<pre>", "</pre>", "code block"),
    },
    {
      label: "🔗",
      title: "Ссылка",
      run: () => apply('<a href="https://">', "</a>", "текст ссылки"),
    },
    {
      label: "👁",
      title: "Спойлер",
      run: () => apply("<tg-spoiler>", "</tg-spoiler>"),
    },
    {
      label: "❝",
      title: "Цитата",
      run: () => apply("<blockquote>", "</blockquote>"),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {buttons.map((b) => (
        <button
          key={b.title}
          type="button"
          title={b.title}
          onClick={b.run}
          className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-accent/50 hover:bg-accent/5"
        >
          {b.label}
        </button>
      ))}
      <span className="self-center pl-1 text-[11px] text-ink-muted">
        {value.length}/4096
      </span>
    </div>
  );
}

function HtmlPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <p className="text-sm text-ink-muted">Превью появится здесь</p>
    );
  }
  return (
    <div
      className="prose prose-sm max-w-none text-ink [&_a]:text-accent [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-bg-soft [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-bg-soft [&_pre]:p-3"
      // Admin-only preview of Telegram HTML tags the user typed themselves.
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusTone(
  status: TelegramPost["status"],
): string {
  if (status === "sent") return "bg-ok/20 text-ok";
  if (status === "failed") return "bg-danger/15 text-danger";
  return "bg-bg-soft text-ink-muted";
}

function statusLabel(status: TelegramPost["status"]): string {
  if (status === "sent") return "Отправлен";
  if (status === "failed") return "Ошибка";
  return "Удалён";
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function TelegramModule() {
  const { busy, setBusy, can } = useAdmin();
  const canWrite = can("telegram.write");
  const [tab, setTab] = useState<TabId>("compose");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState<TelegramSettingsPublic | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [connection, setConnection] = useState<TelegramConnectionInfo | null>(
    null,
  );

  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [parseMode, setParseMode] = useState<TelegramParseMode>("HTML");
  const [disablePreview, setDisablePreview] = useState(false);
  const [silent, setSilent] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/telegram?view=snapshot", {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Не удалось загрузить");
      return;
    }
    const snap = (await res.json()) as Snapshot;
    setData(snap);
    setSettings(snap.settings);
    setParseMode(snap.settings.parseMode);
    setDisablePreview(snap.settings.disablePreview);
    setSilent(snap.settings.silent);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg: string) => {
    setOkMsg(msg);
    window.setTimeout(() => setOkMsg(null), 3200);
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings || !canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settings",
          settings: {
            botToken: tokenDraft,
            channelId: settings.channelId,
            parseMode: settings.parseMode,
            disablePreview: settings.disablePreview,
            silent: settings.silent,
          },
        }),
      });
      const body = (await res.json()) as {
        settings?: TelegramSettingsPublic;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Ошибка сохранения");
      if (body.settings) {
        setSettings(body.settings);
        setData((prev) =>
          prev ? { ...prev, settings: body.settings! } : prev,
        );
        setTokenDraft("");
        setParseMode(body.settings.parseMode);
        setDisablePreview(body.settings.disablePreview);
        setSilent(body.settings.silent);
      }
      flash("Настройки сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    if (!canWrite) {
      setError("Недостаточно прав для проверки связи");
      return;
    }
    if (!settings) return;
    setTesting(true);
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setConnection(null);
    try {
      // Persist form values first so test uses what is on screen.
      const saveRes = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settings",
          settings: {
            botToken: tokenDraft,
            channelId: settings.channelId,
            parseMode: settings.parseMode,
            disablePreview: settings.disablePreview,
            silent: settings.silent,
          },
        }),
      });
      const saveBody = (await saveRes.json()) as {
        settings?: TelegramSettingsPublic;
        error?: string;
      };
      if (!saveRes.ok) {
        throw new Error(saveBody.error ?? "Не удалось сохранить перед проверкой");
      }
      if (saveBody.settings) {
        setSettings(saveBody.settings);
        setData((prev) =>
          prev ? { ...prev, settings: saveBody.settings! } : prev,
        );
        setTokenDraft("");
      }

      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const body = (await res.json()) as {
        connection?: TelegramConnectionInfo;
        settings?: TelegramSettingsPublic;
        error?: string;
      };
      if (!res.ok && !body.connection) {
        throw new Error(body.error ?? "Проверка не удалась");
      }
      if (body.connection) setConnection(body.connection);
      if (body.settings) {
        setSettings(body.settings);
        setData((prev) =>
          prev ? { ...prev, settings: body.settings! } : prev,
        );
      }
      if (body.connection?.ok) flash("Бот и канал доступны");
      else setError(body.connection?.error ?? body.error ?? "Ошибка");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setTesting(false);
      setBusy(false);
    }
  };

  const publishOrEdit = async () => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                action: "edit",
                id: editingId,
                text,
                parseMode,
                disablePreview,
              }
            : {
                action: "publish",
                text,
                photoUrl,
                parseMode,
                disablePreview,
                silent,
              },
        ),
      });
      const body = (await res.json()) as {
        post?: TelegramPost;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Не удалось отправить");
      await load();
      setText("");
      setPhotoUrl("");
      setEditingId(null);
      flash(editingId ? "Пост обновлён" : "Опубликовано в канал");
      setTab("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (post: TelegramPost) => {
    if (post.status === "deleted" || !post.messageId) return;
    setEditingId(post.id);
    setText(post.text);
    setPhotoUrl(post.photoUrl);
    setParseMode(post.parseMode);
    setDisablePreview(post.disablePreview);
    setSilent(post.silent);
    setTab("compose");
  };

  const removePost = async (id: string) => {
    if (!canWrite) return;
    if (!window.confirm("Удалить сообщение из канала?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Не удалось удалить");
      if (editingId === id) {
        setEditingId(null);
        setText("");
        setPhotoUrl("");
      }
      await load();
      flash("Сообщение удалено");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (!data || !settings) {
    return (
      <div className="space-y-4">
        <AdminPageHeader
          title="Telegram"
          description="Публикации в канал"
        />
        <p className="text-sm text-ink-muted">
          {error ?? "Загрузка…"}
        </p>
      </div>
    );
  }

  const sentCount = data.posts.filter((p) => p.status === "sent").length;
  const failedCount = data.posts.filter((p) => p.status === "failed").length;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Telegram"
        description="Постинг и форматирование сообщений в канал"
      />

      <AdminStatGrid
        items={[
          {
            label: "Бот",
            value: settings.botUsername || (settings.hasBotToken ? "задан" : "—"),
          },
          {
            label: "Канал",
            value: settings.channelTitle || settings.channelId || "—",
          },
          { label: "В журнале", value: String(data.posts.length) },
          {
            label: "Последний пост",
            value: settings.lastPostAt
              ? formatWhen(settings.lastPostAt)
              : "—",
          },
        ]}
      />

      <AdminTabBar value={tab} onChange={setTab} tabs={TABS} />

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="rounded-xl border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {okMsg}
        </p>
      ) : null}

      {tab === "compose" && (
        <AdminSection
          title={editingId ? "Редактирование поста" : "Новый пост"}
          description={
            editingId
              ? "Изменения уйдут в уже опубликованное сообщение"
              : "HTML-разметка Telegram: <b> <i> <u> <s> <a> <code> <pre> <tg-spoiler>"
          }
        >
          <div className="space-y-4 p-5">
            {editingId ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Pill className="bg-warn/20 text-warn">Редактирование</Pill>
                <button
                  type="button"
                  className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                  onClick={() => {
                    setEditingId(null);
                    setText("");
                    setPhotoUrl("");
                  }}
                >
                  Отменить
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {PARSE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setParseMode(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    parseMode === m.id
                      ? "bg-accent text-white"
                      : "border border-line text-ink-muted hover:text-ink"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <FormatToolbar
              textareaRef={textareaRef}
              parseMode={parseMode}
              value={text}
              onChange={setText}
            />

            <Field label="Текст сообщения">
              <textarea
                ref={textareaRef}
                className={areaClass}
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Текст поста…"
                maxLength={4096}
              />
            </Field>

            {!editingId ? (
              <Field
                label="URL картинки"
                hint="Необязательно. Если задан — отправится как фото с подписью"
              >
                <input
                  className={inputClass}
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Без превью ссылок"
                hint="disable_web_page_preview"
                checked={disablePreview}
                onChange={setDisablePreview}
              />
              {!editingId ? (
                <Toggle
                  label="Тихая отправка"
                  hint="Без звука у подписчиков"
                  checked={silent}
                  onChange={setSilent}
                />
              ) : null}
            </div>

            {parseMode === "HTML" ? (
              <div className="rounded-xl border border-line bg-bg-soft/40 p-4">
                <p className="mb-2 text-[13px] font-medium text-ink">Превью</p>
                <HtmlPreview text={text} />
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={
                  busy ||
                  !canWrite ||
                  (!text.trim() && !photoUrl.trim()) ||
                  text.length > 4096
                }
                onClick={() => void publishOrEdit()}
                className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {editingId ? "Сохранить в канале" : "Опубликовать"}
              </button>
            </div>
          </div>
        </AdminSection>
      )}

      {tab === "history" && (
        <AdminSection
          title="Журнал"
          description={`${sentCount} отправлено · ${failedCount} с ошибкой`}
        >
          {data.posts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              Пока нет публикаций
            </p>
          ) : (
            <div className="divide-y divide-line/70">
              {data.posts.map((post) => (
                <div key={post.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={statusTone(post.status)}>
                      {statusLabel(post.status)}
                    </Pill>
                    <span className="text-xs text-ink-muted">
                      {formatWhen(post.createdAt)}
                    </span>
                    {post.adminLogin ? (
                      <span className="text-xs text-ink-muted">
                        · {post.adminLogin}
                      </span>
                    ) : null}
                    {post.messageId != null ? (
                      <span className="text-xs text-ink-muted">
                        · msg {post.messageId}
                      </span>
                    ) : null}
                    {post.photoUrl ? (
                      <span className="text-xs text-ink-muted">· фото</span>
                    ) : null}
                  </div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg-soft/60 p-3 font-mono text-[12px] leading-relaxed text-ink">
                    {post.text || "(без текста)"}
                  </pre>
                  {post.error ? (
                    <p className="text-xs text-danger">{post.error}</p>
                  ) : null}
                  {canWrite && post.status === "sent" && post.messageId ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(post)}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/40 disabled:opacity-60"
                      >
                        Править
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removePost(post.id)}
                        className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/5 disabled:opacity-60"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </AdminSection>
      )}

      {tab === "settings" && (
        <form onSubmit={(e) => void saveSettings(e)} className="space-y-4">
          <AdminSection
            title="Бот и канал"
            description="Бот должен быть администратором канала с правом публикации"
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label="Bot token"
                hint={
                  settings.hasBotToken
                    ? `Сейчас: ${settings.botTokenHint}. Оставьте пустым, чтобы не менять.`
                    : data.env.hasBotToken
                      ? "В .env есть TELEGRAM_BOT_TOKEN (подставится при первом запуске)"
                      : "От @BotFather"
                }
                className="sm:col-span-2"
              >
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="off"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder={
                    settings.hasBotToken ? "••••••••••••" : "123456:AA…"
                  }
                  disabled={!canWrite}
                />
              </Field>
              <Field
                label="Канал"
                hint="@username или числовой chat_id (−100…)"
                className="sm:col-span-2"
              >
                <input
                  className={inputClass}
                  value={settings.channelId}
                  onChange={(e) =>
                    setSettings({ ...settings, channelId: e.target.value })
                  }
                  placeholder="@gapsnap_news"
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Parse mode по умолчанию">
                <select
                  className={inputClass}
                  value={settings.parseMode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      parseMode: e.target.value as TelegramParseMode,
                    })
                  }
                  disabled={!canWrite}
                >
                  {PARSE_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="space-y-3">
                <Toggle
                  label="Без превью ссылок по умолчанию"
                  checked={settings.disablePreview}
                  onChange={(v) =>
                    setSettings({ ...settings, disablePreview: v })
                  }
                />
                <Toggle
                  label="Тихая отправка по умолчанию"
                  checked={settings.silent}
                  onChange={(v) => setSettings({ ...settings, silent: v })}
                />
              </div>
            </div>
          </AdminSection>

          {connection ? (
            <AdminSection title="Результат проверки">
              <div className="space-y-1 p-5 text-sm">
                <p>
                  Статус:{" "}
                  <strong className={connection.ok ? "text-ok" : "text-danger"}>
                    {connection.ok ? "OK" : "Ошибка"}
                  </strong>
                </p>
                {connection.botUsername ? (
                  <p className="text-ink-muted">Бот: {connection.botUsername}</p>
                ) : null}
                {connection.channelTitle ? (
                  <p className="text-ink-muted">
                    Канал: {connection.channelTitle} ({connection.channelType}
                    {connection.channelId ? `, id ${connection.channelId}` : ""})
                  </p>
                ) : null}
                {connection.error ? (
                  <p className="text-danger">{connection.error}</p>
                ) : null}
              </div>
            </AdminSection>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy || !canWrite}
              onClick={() => void runTest()}
              className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/40 disabled:opacity-60"
            >
              {testing ? "Проверяю…" : "Проверить связь"}
            </button>
            <button
              type="submit"
              disabled={busy || !canWrite}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Сохранить
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
