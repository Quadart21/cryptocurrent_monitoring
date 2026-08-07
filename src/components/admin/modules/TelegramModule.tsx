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
  TelegramButtonRow,
  TelegramConnectionInfo,
  TelegramParseMode,
  TelegramPost,
  TelegramSettingsPublic,
  TelegramUrlButton,
} from "@/lib/telegram/types";
import type { TelegramContentJob } from "@/lib/telegram/content/types";

type TabId = "compose" | "history" | "queue" | "settings";

type Snapshot = {
  settings: TelegramSettingsPublic;
  posts: TelegramPost[];
  contentJobs: TelegramContentJob[];
  env: { hasBotToken: boolean; hasChannelId: boolean };
  defaultComposePrompt: string;
  composePlaceholders: string[];
  models: Array<{ id: string; ownedBy?: string }>;
  modelsError: string | null;
  newsModel: string;
  siteUrl: string;
  siteName: string;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "compose", label: "Написать" },
  { id: "history", label: "Журнал" },
  { id: "queue", label: "Очередь" },
  { id: "settings", label: "Настройки" },
];

const PARSE_MODES: Array<{ id: TelegramParseMode; label: string }> = [
  { id: "HTML", label: "HTML" },
  { id: "MarkdownV2", label: "MarkdownV2" },
  { id: "Markdown", label: "Markdown" },
];

type ComposePhase = "idle" | "text" | "image" | "done";

type ComposeProgress = {
  phase: ComposePhase;
  label: string;
  /** 0–100 */
  percent: number;
  startedAt: number | null;
  withImage: boolean;
  /** false for «только картинка» — не показываем шаг «Текст» */
  includeTextStep: boolean;
};

const COMPOSE_IDLE: ComposeProgress = {
  phase: "idle",
  label: "",
  percent: 0,
  startedAt: null,
  withImage: false,
  includeTextStep: true,
};

async function readTelegramApiJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`Пустой ответ сервера (HTTP ${res.status})`);
  }
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new Error(
      res.status === 504 || res.status === 502 || res.status === 524
        ? "Прокси (Cloudflare/nginx) оборвал долгий запрос. Картинка теперь генерируется в фоне — обновите страницу и попробуйте ещё раз."
        : `Сервер вернул HTML вместо JSON (HTTP ${res.status}). Часто это таймаут Cloudflare (~100с).`,
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Невалидный JSON (HTTP ${res.status}): ${trimmed.slice(0, 160)}`,
    );
  }
}

type ImageJobSnapshot = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  progress: string;
  percent: number;
  photoUrl: string;
  error: string | null;
  elapsedMs: number;
};

async function pollTelegramImageJob(
  jobId: string,
  onTick: (job: ImageJobSnapshot) => void,
): Promise<string> {
  const startedAt = Date.now();
  let badStreak = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(
        `/api/admin/telegram?view=compose-image-job&id=${encodeURIComponent(jobId)}`,
        { cache: "no-store" },
      );
      const body = await readTelegramApiJson<{
        job?: ImageJobSnapshot;
        error?: string;
      }>(res);
      if (!res.ok || !body.job) {
        badStreak += 1;
        if (badStreak >= 6) {
          throw new Error(body.error ?? "Не удалось получить статус картинки");
        }
        continue;
      }
      badStreak = 0;
      onTick(body.job);
      if (body.job.status === "done") {
        if (!body.job.photoUrl) throw new Error("Картинка не вернулась");
        return body.job.photoUrl;
      }
      if (body.job.status === "error") {
        throw new Error(body.job.error || "Ошибка генерации картинки");
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.startsWith("Прокси") ||
          err.message.startsWith("Сервер вернул HTML") ||
          err.message.startsWith("Картинка") ||
          err.message.startsWith("Ошибка генерации") ||
          err.message.startsWith("Невалидный"))
      ) {
        // Soft-retry transient HTML/network blips while job may still be running.
        if (
          err.message.startsWith("Прокси") ||
          err.message.startsWith("Сервер вернул HTML") ||
          err.message.startsWith("Невалидный")
        ) {
          badStreak += 1;
          if (badStreak < 6) continue;
        }
        throw err;
      }
      badStreak += 1;
      if (badStreak >= 6) {
        throw err instanceof Error ? err : new Error("Статус картинки недоступен");
      }
    }
    if (Date.now() - startedAt > 4 * 60_000) {
      throw new Error(
        "Генерация картинки дольше 4 минут — смотрите pm2 logs gapsnap-web",
      );
    }
  }
}

function ComposeStatusBar({
  progress,
  elapsedSec,
}: {
  progress: ComposeProgress;
  elapsedSec: number;
}) {
  if (progress.phase === "idle") return null;
  const steps = [
    ...(progress.includeTextStep
      ? [{ id: "text" as const, label: "Текст" }]
      : []),
    ...(progress.withImage
      ? [{ id: "image" as const, label: "Картинка" }]
      : []),
    { id: "done" as const, label: "Готово" },
  ];
  const activeIdx = steps.findIndex((s) => s.id === progress.phase);

  return (
    <div className="space-y-2.5 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{progress.label}</p>
        <p className="tabular-nums text-xs text-ink-muted">
          {elapsedSec}с · {progress.percent}%
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line/70">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(4, progress.percent))}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => {
          const done =
            progress.phase === "done" || (activeIdx >= 0 && i < activeIdx);
          const active = step.id === progress.phase && progress.phase !== "done";
          return (
            <span
              key={step.id}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                done
                  ? "bg-ok/15 text-ok"
                  : active
                    ? "bg-accent/20 text-accent-deep"
                    : "bg-bg-soft text-ink-muted"
              }`}
            >
              {done ? "✓ " : active ? "… " : ""}
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

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
  if (status === "draft") return "bg-accent/15 text-accent-deep";
  if (status === "generating") return "bg-warn/20 text-warn";
  if (status === "failed") return "bg-danger/15 text-danger";
  return "bg-bg-soft text-ink-muted";
}

function statusLabel(status: TelegramPost["status"]): string {
  if (status === "sent") return "Отправлен";
  if (status === "draft") return "Черновик готов";
  if (status === "generating") return "Генерируется…";
  if (status === "failed") return "Ошибка";
  return "Удалён";
}

function contentJobStatusLabel(status: TelegramContentJob["status"]): string {
  if (status === "queued") return "В очереди";
  if (status === "drafted") return "Черновик";
  if (status === "published") return "Опубликован";
  if (status === "failed") return "Ошибка";
  if (status === "skipped") return "Пропуск";
  if (status === "discarded") return "Отменена";
  return status;
}

function contentJobKindLabel(kind: TelegramContentJob["kind"]): string {
  return kind === "news" ? "Новость" : "Спред";
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

function emptyButton(): TelegramUrlButton {
  return { text: "", url: "" };
}

const BUTTON_PRESETS: Array<{ label: string; text: string; path: string }> = [
  { label: "Курсы", text: "Сравнить курсы", path: "/" },
  { label: "Каталог", text: "Каталог обменников", path: "/exchangers" },
  { label: "Новости", text: "Читать новости", path: "/blog" },
  { label: "ЧС", text: "Чёрный список", path: "/blacklist" },
  { label: "Реклама", text: "Реклама на GapSnap", path: "/advertise" },
  { label: "Добавить", text: "Добавить обменник", path: "/apply" },
  { label: "Кабинет", text: "Кабинет владельца", path: "/cabinet" },
  { label: "API", text: "Документация API", path: "/api-docs" },
  { label: "Партнёры", text: "Партнёрская программа", path: "/partners" },
];

function ButtonsEditor({
  rows,
  onChange,
  siteUrl,
  disabled,
}: {
  rows: TelegramButtonRow[];
  onChange: (rows: TelegramButtonRow[]) => void;
  siteUrl: string;
  disabled?: boolean;
}) {
  const base = siteUrl.replace(/\/+$/, "") || "https://gapsnap.org";

  const updateButton = (
    rowIdx: number,
    btnIdx: number,
    patch: Partial<TelegramUrlButton>,
  ) => {
    onChange(
      rows.map((row, ri) =>
        ri !== rowIdx
          ? row
          : row.map((b, bi) => (bi === btnIdx ? { ...b, ...patch } : b)),
      ),
    );
  };

  const removeButton = (rowIdx: number, btnIdx: number) => {
    const next = rows
      .map((row, ri) =>
        ri !== rowIdx ? row : row.filter((_, bi) => bi !== btnIdx),
      )
      .filter((row) => row.length > 0);
    onChange(next);
  };

  const addButton = (rowIdx: number) => {
    onChange(
      rows.map((row, ri) =>
        ri === rowIdx && row.length < 8 ? [...row, emptyButton()] : row,
      ),
    );
  };

  const addRow = () => {
    if (rows.length >= 8) return;
    onChange([...rows, [emptyButton()]]);
  };

  const addPreset = (text: string, url: string) => {
    if (!rows.length) {
      onChange([[{ text, url }]]);
      return;
    }
    const last = rows[rows.length - 1]!;
    if (last.length < 8) {
      onChange(
        rows.map((row, i) =>
          i === rows.length - 1 ? [...row, { text, url }] : row,
        ),
      );
    } else if (rows.length < 8) {
      onChange([...rows, [{ text, url }]]);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-bg-soft/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-ink">Кнопки (URL)</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Inline-кнопки со ссылками. Для канала это основной тип.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BUTTON_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() =>
                addPreset(
                  preset.text,
                  preset.path === "/" ? `${base}/` : `${base}${preset.path}`,
                )
              }
              className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Кнопок нет</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, rowIdx) => (
            <div
              key={`row-${rowIdx}`}
              className="space-y-2 rounded-lg border border-line/70 bg-bg p-3"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                Ряд {rowIdx + 1}
              </p>
              {row.map((btn, btnIdx) => (
                <div
                  key={`b-${rowIdx}-${btnIdx}`}
                  className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
                >
                  <input
                    className={inputClass}
                    value={btn.text}
                    onChange={(e) =>
                      updateButton(rowIdx, btnIdx, { text: e.target.value })
                    }
                    placeholder="Текст"
                    maxLength={64}
                    disabled={disabled}
                  />
                  <input
                    className={inputClass}
                    value={btn.url}
                    onChange={(e) =>
                      updateButton(rowIdx, btnIdx, { url: e.target.value })
                    }
                    placeholder="https://…"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeButton(rowIdx, btnIdx)}
                    className="rounded-xl border border-danger/30 px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger/5 disabled:opacity-60"
                  >
                    Удалить
                  </button>
                </div>
              ))}
              {row.length < 8 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => addButton(rowIdx)}
                  className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
                >
                  + кнопка в этот ряд
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {rows.length < 8 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={addRow}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/40 disabled:opacity-60"
        >
          + ряд кнопок
        </button>
      ) : null}

      {rows.some((r) => r.some((b) => b.text.trim() && b.url.trim())) ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {rows.map((row, ri) => (
            <div key={`prev-${ri}`} className="flex flex-wrap gap-1.5">
              {row
                .filter((b) => b.text.trim() && b.url.trim())
                .map((b, bi) => (
                  <span
                    key={`pb-${ri}-${bi}`}
                    className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-deep"
                  >
                    {b.text}
                  </span>
                ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
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
  const [draftId, setDraftId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [topic, setTopic] = useState("");
  const [composing, setComposing] = useState(false);
  const [composingImage, setComposingImage] = useState(false);
  const [withImage, setWithImage] = useState(true);
  const [composeProgress, setComposeProgress] =
    useState<ComposeProgress>(COMPOSE_IDLE);
  const [composeElapsed, setComposeElapsed] = useState(0);
  const [buttonRows, setButtonRows] = useState<TelegramButtonRow[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seenDraftReadyRef = useRef<Set<string>>(new Set());
  const bootstrappedDraftsRef = useRef(false);

  const generatingCount =
    data?.posts.filter((p) => p.status === "generating").length ?? 0;
  const draftCount =
    data?.posts.filter((p) => p.status === "draft").length ?? 0;

  useEffect(() => {
    if (!composeProgress.startedAt || composeProgress.phase === "idle") {
      setComposeElapsed(0);
      return;
    }
    const tick = () => {
      setComposeElapsed(
        Math.max(
          0,
          Math.floor((Date.now() - (composeProgress.startedAt as number)) / 1000),
        ),
      );
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [composeProgress.startedAt, composeProgress.phase]);

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
    setData((prev) => {
      // Notify about newly finished drafts is handled in effect.
      return snap;
    });
    setSettings(snap.settings);
    setDisablePreview(snap.settings.disablePreview);
    setSilent(snap.settings.silent);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep journal fresh while background compose jobs run.
  useEffect(() => {
    if (generatingCount <= 0) return;
    const id = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(id);
  }, [generatingCount, load]);

  useEffect(() => {
    if (!data) return;
    if (!bootstrappedDraftsRef.current) {
      for (const p of data.posts) {
        if (p.status === "draft" || p.status === "generating") {
          seenDraftReadyRef.current.add(p.id);
        }
      }
      bootstrappedDraftsRef.current = true;
      return;
    }
    for (const p of data.posts) {
      if (p.status !== "draft") continue;
      if (seenDraftReadyRef.current.has(p.id)) continue;
      seenDraftReadyRef.current.add(p.id);
      setOkMsg(
        `Черновик готов — зайдите в журнал и откройте${p.topic ? `: «${p.topic.slice(0, 60)}»` : ""}`,
      );
      window.setTimeout(() => setOkMsg(null), 7000);
    }
  }, [data]);

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
            composeModel: settings.composeModel,
            composePrompt: settings.composePrompt,
            contentEnabled: settings.contentEnabled,
            contentSpreadEnabled: settings.contentSpreadEnabled,
            contentNewsEnabled: settings.contentNewsEnabled,
            contentMinSpreadPct: settings.contentMinSpreadPct,
            contentMinOffers: settings.contentMinOffers,
            contentMaxSpreadPerRun: settings.contentMaxSpreadPerRun,
            contentSpreadCooldownHours: settings.contentSpreadCooldownHours,
            contentAutoPublish: settings.contentAutoPublish,
            contentMaxPostsPerDay: settings.contentMaxPostsPerDay,
            contentMinIntervalMinutes: settings.contentMinIntervalMinutes,
            contentQuietStartHour: settings.contentQuietStartHour,
            contentQuietEndHour: settings.contentQuietEndHour,
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

  const runContentCycle = async (force = false) => {
    if (!canWrite) {
      setError("Недостаточно прав");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "content-run", force }),
      });
      const body = (await res.json()) as {
        result?: { message?: string };
        contentJobs?: TelegramContentJob[];
        posts?: TelegramPost[];
        settings?: TelegramSettingsPublic;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Ошибка запуска");
      setData((prev) =>
        prev
          ? {
              ...prev,
              contentJobs: body.contentJobs ?? prev.contentJobs,
              posts: body.posts ?? prev.posts,
              settings: body.settings ?? prev.settings,
            }
          : prev,
      );
      if (body.settings) setSettings(body.settings);
      flash(body.result?.message ?? "Цикл выполнен");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const discardContentJob = async (id: string) => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "content-discard", id }),
      });
      const body = (await res.json()) as {
        contentJobs?: TelegramContentJob[];
        posts?: TelegramPost[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Ошибка");
      setData((prev) =>
        prev
          ? {
              ...prev,
              contentJobs: body.contentJobs ?? prev.contentJobs,
              posts: body.posts ?? prev.posts,
            }
          : prev,
      );
      flash("Задача отменена");
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
            composeModel: settings.composeModel,
            composePrompt: settings.composePrompt,
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

  const runCompose = async () => {
    if (!canWrite) {
      setError("Недостаточно прав");
      return;
    }
    if (!topic.trim()) {
      setError("Опишите тему или обновление");
      return;
    }
    setComposing(true);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compose-start",
          topic,
          withImage,
          model: settings?.composeModel || undefined,
        }),
      });
      const body = await readTelegramApiJson<{
        post?: TelegramPost;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(body.error ?? "Не удалось запустить генерацию");
      if (body.post) {
        seenDraftReadyRef.current.delete(body.post.id);
        await load();
        setTopic("");
        flash(
          withImage
            ? "Генерация поста и картинки запущена в фоне — смотрите журнал"
            : "Генерация поста запущена в фоне — смотрите журнал",
        );
        setTab("history");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setComposing(false);
      setBusy(false);
    }
  };

  const runComposeImage = async () => {
    if (!canWrite) {
      setError("Недостаточно прав");
      return;
    }
    if (!text.trim()) {
      setError("Сначала нужен текст поста");
      return;
    }
    const startedAt = Date.now();
    setComposingImage(true);
    setBusy(true);
    setError(null);
    setComposeProgress({
      phase: "image",
      label: "Запускаю генерацию обложки в фоне…",
      percent: 20,
      startedAt,
      withImage: true,
      includeTextStep: false,
    });
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compose-image",
          text,
          topic,
        }),
      });
      const body = await readTelegramApiJson<{
        jobId?: string;
        error?: string;
      }>(res);
      if (!res.ok || !body.jobId) {
        throw new Error(body.error ?? "Не удалось запустить генерацию картинки");
      }

      const photo = await pollTelegramImageJob(body.jobId, (job) => {
        setComposeProgress({
          phase: "image",
          label: job.progress || "Рисую обложку…",
          percent: Math.max(25, Math.min(95, job.percent || 40)),
          startedAt,
          withImage: true,
          includeTextStep: false,
        });
      });
      setPhotoUrl(photo);
      setComposeProgress({
        phase: "done",
        label: "Картинка готова",
        percent: 100,
        startedAt,
        withImage: true,
        includeTextStep: false,
      });
      flash("Картинка сгенерирована");
    } catch (err) {
      setComposeProgress(COMPOSE_IDLE);
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setComposingImage(false);
      setBusy(false);
      window.setTimeout(() => setComposeProgress(COMPOSE_IDLE), 2800);
    }
  };

  const resetComposePrompt = async () => {
    if (!settings || !canWrite || !data) return;
    setSettings({
      ...settings,
      composePrompt: data.defaultComposePrompt,
    });
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
                buttons: buttonRows,
              }
            : {
                action: "publish",
                text,
                photoUrl,
                parseMode,
                disablePreview,
                silent,
                buttons: buttonRows,
                draftId: draftId || undefined,
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
      setButtonRows([]);
      setEditingId(null);
      setDraftId(null);
      setTopic("");
      flash(editingId ? "Пост обновлён" : "Опубликовано в канал");
      setTab("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const openDraft = (post: TelegramPost) => {
    if (post.status !== "draft" && post.status !== "failed") return;
    setEditingId(null);
    setDraftId(post.id);
    setText(post.text);
    setPhotoUrl(post.photoUrl);
    setParseMode(post.parseMode);
    setDisablePreview(post.disablePreview);
    setSilent(post.silent);
    setButtonRows(
      post.buttons?.length
        ? post.buttons.map((row) => row.map((b) => ({ ...b })))
        : [],
    );
    setTopic(post.topic || "");
    setTab("compose");
    flash("Черновик открыт — правьте и публикуйте");
  };

  const openDraftFromJob = (job: TelegramContentJob) => {
    if (!job.postId || !data) return;
    const post = data.posts.find((p) => p.id === job.postId);
    if (!post) {
      setTab("history");
      flash("Черновик не найден в журнале — обновите страницу");
      return;
    }
    openDraft(post);
  };

  const discardDraft = async (id: string) => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discard-draft", id }),
      });
      const body = await readTelegramApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(body.error ?? "Не удалось удалить");
      if (draftId === id) {
        setDraftId(null);
        setText("");
        setPhotoUrl("");
        setButtonRows([]);
        setTopic("");
      }
      await load();
      flash("Черновик удалён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (post: TelegramPost) => {
    if (post.status === "deleted" || !post.messageId) return;
    setDraftId(null);
    setEditingId(post.id);
    setText(post.text);
    setPhotoUrl(post.photoUrl);
    setParseMode(post.parseMode);
    setDisablePreview(post.disablePreview);
    setSilent(post.silent);
    setButtonRows(
      post.buttons?.length
        ? post.buttons.map((row) => row.map((b) => ({ ...b })))
        : [],
    );
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
        setButtonRows([]);
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
  const visiblePosts = data.posts.filter((p) => p.status !== "deleted");

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Telegram"
        description="Постинг и форматирование сообщений в канал"
      />

      {(generatingCount > 0 || draftCount > 0) && (
        <p className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-ink">
          {generatingCount > 0 ? (
            <>
              Идёт генерация: <strong>{generatingCount}</strong>
              {draftCount > 0 ? " · " : null}
            </>
          ) : null}
          {draftCount > 0 ? (
            <>
              Черновиков готово: <strong>{draftCount}</strong> — откройте в
              журнале
            </>
          ) : null}
        </p>
      )}

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
          {
            label: "Черновики",
            value: String(draftCount + generatingCount),
          },
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
          title={
            editingId
              ? "Редактирование поста"
              : draftId
                ? "Черновик"
                : "Новый пост"
          }
          description={
            editingId
              ? "Изменения уйдут в уже опубликованное сообщение"
              : draftId
                ? "Черновик из журнала — правьте и публикуйте"
                : "Тема → генерация в фоне (текст + картинка) → черновик в журнале"
          }
        >
          <div className="space-y-4 p-5">
            {editingId || draftId ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Pill
                  className={
                    editingId ? "bg-warn/20 text-warn" : "bg-accent/15 text-accent-deep"
                  }
                >
                  {editingId ? "Редактирование" : "Черновик"}
                </Pill>
                <button
                  type="button"
                  className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                  onClick={() => {
                    setEditingId(null);
                    setDraftId(null);
                    setText("");
                    setPhotoUrl("");
                    setButtonRows([]);
                    setTopic("");
                  }}
                >
                  Отменить
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-line bg-bg-soft/30 p-4">
                <Field
                  label="Тема / обновление"
                  hint="Например: «Добавили 10 новых обменников» или «Запустили API v2»"
                >
                  <textarea
                    className={`${inputClass} min-h-[88px] resize-y`}
                    rows={3}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Кратко опишите, о чём пост…"
                    disabled={!canWrite || composing}
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-ink-muted">
                    Модель:{" "}
                    <strong className="text-ink">
                      {settings.composeModel || "не выбрана"}
                    </strong>
                    {data.modelsError ? (
                      <span className="text-danger"> · {data.modelsError}</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted select-none">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-line accent-[var(--accent)]"
                        checked={withImage}
                        onChange={(e) => setWithImage(e.target.checked)}
                        disabled={!canWrite || composing}
                      />
                      С картинкой
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy || !canWrite || !topic.trim() || composing
                      }
                      onClick={() => void runCompose()}
                      className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      {composing ? "Запускаю…" : "Сгенерировать в фоне"}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-ink-muted">
                  Можно закрыть вкладку: прогресс и готовый черновик появятся в
                  журнале.
                </p>
              </div>
            )}

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
              <div className="space-y-3">
                {composingImage &&
                composeProgress.phase !== "idle" &&
                !composeProgress.includeTextStep ? (
                  <ComposeStatusBar
                    progress={composeProgress}
                    elapsedSec={composeElapsed}
                  />
                ) : null}
                <Field
                  label="Картинка"
                  hint="ИИ генерирует обложку по тексту поста. Можно вставить свой URL."
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className={inputClass}
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://… или /api/tg-images/…"
                    />
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !canWrite ||
                        !text.trim() ||
                        composing ||
                        composingImage
                      }
                      onClick={() => void runComposeImage()}
                      className="shrink-0 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/40 disabled:opacity-60"
                    >
                      {composingImage
                        ? "Рисую…"
                        : photoUrl
                          ? "Перегенерировать"
                          : "Сгенерировать картинку"}
                    </button>
                  </div>
                </Field>
                {photoUrl.trim() ? (
                  <div className="overflow-hidden rounded-xl border border-line bg-bg-soft/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl.trim()}
                      alt="Превью обложки поста"
                      className="mx-auto max-h-64 w-full object-contain"
                    />
                    <div className="flex justify-end border-t border-line/70 px-3 py-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                        onClick={() => setPhotoUrl("")}
                      >
                        Убрать картинку
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ButtonsEditor
              rows={buttonRows}
              onChange={setButtonRows}
              siteUrl={data.siteUrl}
              disabled={!canWrite || busy}
            />

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
                {editingId
                  ? "Сохранить в канале"
                  : draftId
                    ? "Опубликовать черновик"
                    : "Опубликовать"}
              </button>
            </div>
          </div>
        </AdminSection>
      )}

      {tab === "history" && (
        <AdminSection
          title="Журнал"
          description={`${sentCount} отправлено · ${draftCount} черновиков · ${generatingCount} в генерации · ${failedCount} с ошибкой`}
        >
          {visiblePosts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              Пока нет публикаций
            </p>
          ) : (
            <div className="divide-y divide-line/70">
              {visiblePosts.map((post) => (
                <div key={post.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={statusTone(post.status)}>
                      {statusLabel(post.status)}
                    </Pill>
                    <span className="text-xs text-ink-muted">
                      {formatWhen(post.updatedAt || post.createdAt)}
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
                    {post.withImage && post.status === "generating" ? (
                      <span className="text-xs text-ink-muted">· +картинка</span>
                    ) : null}
                    {post.buttons?.length ? (
                      <span className="text-xs text-ink-muted">
                        · {post.buttons.reduce((n, r) => n + r.length, 0)} кн.
                      </span>
                    ) : null}
                  </div>
                  {post.topic ? (
                    <p className="text-xs text-ink-muted">
                      Тема: <span className="text-ink">{post.topic}</span>
                    </p>
                  ) : null}
                  {post.status === "generating" ? (
                    <p className="text-sm text-warn">
                      {post.progress || "Генерация…"}
                    </p>
                  ) : null}
                  {post.status === "draft" ? (
                    <p className="text-sm text-accent-deep">
                      {post.progress || "Черновик готов — откройте и опубликуйте"}
                    </p>
                  ) : null}
                  {post.photoUrl &&
                  (post.status === "draft" || post.status === "sent") ? (
                    <div className="overflow-hidden rounded-lg border border-line bg-bg-soft/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.photoUrl}
                        alt=""
                        className="mx-auto max-h-40 object-contain"
                      />
                    </div>
                  ) : null}
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg-soft/60 p-3 font-mono text-[12px] leading-relaxed text-ink">
                    {post.text ||
                      (post.status === "generating"
                        ? "(ещё генерируется…)"
                        : "(без текста)")}
                  </pre>
                  {post.buttons?.length ? (
                    <div className="flex flex-col gap-1.5">
                      {post.buttons.map((row, ri) => (
                        <div key={`${post.id}-r-${ri}`} className="flex flex-wrap gap-1.5">
                          {row.map((b, bi) => (
                            <a
                              key={`${post.id}-b-${ri}-${bi}`}
                              href={b.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent-deep hover:underline"
                            >
                              {b.text}
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {post.error ? (
                    <p className="text-xs text-danger">{post.error}</p>
                  ) : null}
                  {canWrite &&
                  (post.status === "draft" || post.status === "failed") ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openDraft(post)}
                        className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-deep transition hover:bg-accent/15 disabled:opacity-60"
                      >
                        Открыть черновик
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void discardDraft(post.id)}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-60"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : null}
                  {canWrite && post.status === "generating" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void discardDraft(post.id)}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-60"
                      >
                        Отменить генерацию
                      </button>
                    </div>
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

      {tab === "queue" && (
        <AdminSection
          title="Контент-машина"
          description={
            settings.contentEnabled
              ? `${settings.contentAutoPublish ? "Автопост включён" : "Только черновики"} · ${settings.contentLastRunResult || "ещё не запускалась"}${
                  settings.contentLastRunAt
                    ? ` · ${formatWhen(settings.contentLastRunAt)}`
                    : ""
                }`
              : "Выключена — включите в настройках (автопост пойдёт сам)"
          }
        >
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canWrite || busy}
                onClick={() => void runContentCycle(false)}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
              >
                Запустить цикл
              </button>
              <button
                type="button"
                disabled={!canWrite || busy}
                onClick={() => void runContentCycle(true)}
                className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/40 disabled:opacity-60"
              >
                Принудительно (даже если выкл.)
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              Спреды (≥{settings.contentMinSpreadPct}% · ≥
              {settings.contentMinOffers} офферов) и новости блога. Автопост: до{" "}
              {settings.contentMaxPostsPerDay}/день, интервал{" "}
              {settings.contentMinIntervalMinutes} мин, тихие часы{" "}
              {settings.contentQuietStartHour}:00–
              {settings.contentQuietEndHour}:00 МСК (если начало≠конец).
            </p>
            {(data.contentJobs ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                Очередь пуста — запустите цикл или дождитесь поллера (каждые
                ~15 мин на worker)
              </p>
            ) : (
              <div className="divide-y divide-line/70 rounded-xl border border-line">
                {(data.contentJobs ?? []).map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill className="bg-bg-soft text-ink">
                          {contentJobKindLabel(job.kind)}
                        </Pill>
                        <Pill
                          className={
                            job.status === "published"
                              ? "bg-ok/15 text-ok"
                              : job.status === "drafted"
                              ? "bg-accent/15 text-accent-deep"
                              : job.status === "failed"
                                ? "bg-danger/10 text-danger"
                                : job.status === "discarded"
                                  ? "bg-bg-soft text-ink-muted"
                                  : "bg-warn/15 text-warn"
                          }
                        >
                          {contentJobStatusLabel(job.status)}
                        </Pill>
                        <span className="text-xs text-ink-muted">
                          {formatWhen(job.updatedAt || job.createdAt)}
                        </span>
                      </div>
                      <p className="truncate text-sm text-ink">{job.title}</p>
                      {job.error ? (
                        <p className="text-xs text-danger">{job.error}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {job.postId && job.status === "drafted" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openDraftFromJob(job)}
                          className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent-deep transition hover:bg-accent/5 disabled:opacity-60"
                        >
                          Открыть черновик
                        </button>
                      ) : null}
                      {job.status !== "discarded" ? (
                        <button
                          type="button"
                          disabled={!canWrite || busy}
                          onClick={() => void discardContentJob(job.id)}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-60"
                        >
                          Отменить
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

          <AdminSection
            title="Контент-машина"
            description="Спреды и новости → черновики → автопост в канал (без ручной публикации)."
          >
            <div className="space-y-4 p-5">
              <Toggle
                label="Включить контент-машину"
                hint="Worker крутит цикл ~раз в 15 минут"
                checked={settings.contentEnabled}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    contentEnabled: v,
                    // when turning on — ensure auto-publish stays on
                    contentAutoPublish: v ? true : settings.contentAutoPublish,
                  })
                }
              />
              <Toggle
                label="Автопостинг в канал"
                hint="Без вашего участия: черновик сразу уходит в Telegram"
                checked={settings.contentAutoPublish}
                onChange={(v) =>
                  setSettings({ ...settings, contentAutoPublish: v })
                }
              />
              <Toggle
                label="Детектор спредов"
                checked={settings.contentSpreadEnabled}
                onChange={(v) =>
                  setSettings({ ...settings, contentSpreadEnabled: v })
                }
              />
              <Toggle
                label="Зеркало новостей"
                checked={settings.contentNewsEnabled}
                onChange={(v) =>
                  setSettings({ ...settings, contentNewsEnabled: v })
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Мин. разброс, %">
                  <input
                    className={inputClass}
                    type="number"
                    min={0.1}
                    max={50}
                    step={0.1}
                    value={settings.contentMinSpreadPct}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentMinSpreadPct: Number(e.target.value) || 1.5,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Мин. офферов по паре">
                  <input
                    className={inputClass}
                    type="number"
                    min={2}
                    max={50}
                    step={1}
                    value={settings.contentMinOffers}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentMinOffers: Number(e.target.value) || 3,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Макс. спредов за цикл">
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={settings.contentMaxSpreadPerRun}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentMaxSpreadPerRun: Number(e.target.value) || 3,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Кулдаун пары, часов">
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={168}
                    step={1}
                    value={settings.contentSpreadCooldownHours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentSpreadCooldownHours: Number(e.target.value) || 6,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Макс. постов / день">
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={48}
                    step={1}
                    value={settings.contentMaxPostsPerDay}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentMaxPostsPerDay: Number(e.target.value) || 12,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Мин. интервал, мин">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={720}
                    step={1}
                    value={settings.contentMinIntervalMinutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentMinIntervalMinutes:
                          Number(e.target.value) || 0,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Тихие часы с (МСК)">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={23}
                    step={1}
                    value={settings.contentQuietStartHour}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentQuietStartHour: Number(e.target.value) || 0,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
                <Field
                  label="Тихие часы до (МСК)"
                  hint="Равны start = тихие часы выкл."
                >
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={23}
                    step={1}
                    value={settings.contentQuietEndHour}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contentQuietEndHour: Number(e.target.value) || 0,
                      })
                    }
                    disabled={!canWrite}
                  />
                </Field>
              </div>
              {settings.contentLastRunAt ? (
                <p className="text-xs text-ink-muted">
                  Последний цикл: {formatWhen(settings.contentLastRunAt)}
                  {settings.contentLastRunResult
                    ? ` — ${settings.contentLastRunResult}`
                    : ""}
                </p>
              ) : null}
            </div>
          </AdminSection>

          <AdminSection
            title="ИИ для постов"
            description="Текст — модель Codex из списка. Обложка — CODEX_IMAGE_MODEL (по умолчанию gpt-image-2). Плейсхолдеры: {{topic}} {{siteName}} {{siteUrl}}"
          >
            <div className="space-y-4 p-5">
              <Field label="Модель">
                <select
                  className={inputClass}
                  value={settings.composeModel}
                  onChange={(e) =>
                    setSettings({ ...settings, composeModel: e.target.value })
                  }
                  disabled={!canWrite}
                >
                  <option value="">
                    {data.newsModel
                      ? `Как в Новостях (${data.newsModel})`
                      : "Выберите модель"}
                  </option>
                  {settings.composeModel &&
                  !data.models.some((m) => m.id === settings.composeModel) ? (
                    <option value={settings.composeModel}>
                      {settings.composeModel} (нет в списке)
                    </option>
                  ) : null}
                  {data.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                      {m.ownedBy ? ` · ${m.ownedBy}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {data.modelsError ? (
                <p className="text-xs text-danger">{data.modelsError}</p>
              ) : null}
              <Field label="Промпт генерации">
                <textarea
                  className={areaClass}
                  rows={12}
                  value={settings.composePrompt}
                  onChange={(e) =>
                    setSettings({ ...settings, composePrompt: e.target.value })
                  }
                  disabled={!canWrite}
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => void resetComposePrompt()}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
                >
                  Сбросить промпт
                </button>
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
