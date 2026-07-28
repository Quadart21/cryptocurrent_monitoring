"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection, StatusPill } from "@/components/admin/ui";
import type {
  BlogPost,
  NewsSettings,
  NewsSyncResultSummary,
} from "@/lib/store-types";

type CodexModel = { id: string; ownedBy?: string };

const empty: {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  tags: string;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  authorName: string;
} = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverImageUrl: "",
  tags: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
  authorName: "GapSnap",
};

export function BlogModule() {
  const { busy, setBusy } = useAdmin();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<NewsSettings | null>(null);
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [models, setModels] = useState<CodexModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<NewsSyncResultSummary | null>(
    null,
  );
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    const res = await fetch("/api/admin/blog", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { posts: BlogPost[] };
    setPosts(body.posts ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/news/settings", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as {
      settings: NewsSettings;
      defaultPrompt: string;
      placeholders: string[];
    };
    setSettings(body.settings);
    setDefaultPrompt(body.defaultPrompt ?? "");
    setPlaceholders(body.placeholders ?? []);
    if (body.settings.lastSyncResult) {
      setSyncResult(body.settings.lastSyncResult);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setModelsError(null);
    const res = await fetch("/api/admin/news/models", { cache: "no-store" });
    const body = (await res.json()) as {
      models?: CodexModel[];
      error?: string;
    };
    setModels(body.models ?? []);
    if (!res.ok) {
      setModelsError(body.error || "Не удалось загрузить модели");
    }
  }, []);

  useEffect(() => {
    void loadPosts();
    void loadSettings();
    void loadModels();
  }, [loadPosts, loadSettings, loadModels]);

  async function saveSettings(patch: {
    model?: string;
    rewritePrompt?: string;
    enabled?: boolean;
    resetPrompt?: boolean;
  }) {
    setBusy(true);
    setSettingsMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/news/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await res.json()) as {
        settings?: NewsSettings;
        error?: string;
      };
      if (!res.ok || !body.settings) {
        throw new Error(body.error || "fail");
      }
      setSettings(body.settings);
      setSettingsMsg("Настройки сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    setBusy(true);
    setError(null);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/news/sync", { method: "POST" });
      const raw = await res.text();
      let body: {
        error?: string;
        message?: string;
        alreadyRunning?: boolean;
      } = {};
      try {
        body = raw ? (JSON.parse(raw) as typeof body) : {};
      } catch {
        throw new Error(
          raw.trim().startsWith("<!")
            ? "Сервер вернул HTML вместо JSON (часто таймаут прокси или не пересобранный деплой). Обновите код и перезапустите."
            : `Невалидный ответ API: ${raw.slice(0, 160)}`,
        );
      }
      if (!res.ok) {
        throw new Error(body.error || "Синхронизация не удалась");
      }

      setSettingsMsg(
        body.alreadyRunning
          ? "Синхронизация уже идёт — жду завершения…"
          : "Синхронизация запущена в фоне — жду завершения…",
      );

      const startedAt = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, 2500));
        const statusRes = await fetch("/api/admin/news/sync", {
          cache: "no-store",
        });
        const statusRaw = await statusRes.text();
        let statusBody: {
          inFlight?: boolean;
          lastSyncResult?: NewsSyncResultSummary | null;
          error?: string;
        } = {};
        try {
          statusBody = statusRaw
            ? (JSON.parse(statusRaw) as typeof statusBody)
            : {};
        } catch {
          throw new Error("Не удалось прочитать статус синка");
        }
        if (!statusRes.ok) {
          throw new Error(statusBody.error || "Ошибка статуса синка");
        }
        if (!statusBody.inFlight) {
          if (statusBody.lastSyncResult) {
            setSyncResult(statusBody.lastSyncResult);
            setSettingsMsg(
              `Готово: создано ${statusBody.lastSyncResult.created}, пропущено ${statusBody.lastSyncResult.skipped}, ошибок ${statusBody.lastSyncResult.failed}`,
            );
          } else {
            setSettingsMsg("Синхронизация завершена");
          }
          await loadPosts();
          await loadSettings();
          break;
        }
        if (Date.now() - startedAt > 45 * 60 * 1000) {
          throw new Error(
            "Синк всё ещё выполняется дольше 45 минут — обновите страницу позже",
          );
        }
        setSettingsMsg("Синхронизация в фоне… (можно подождать)");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка синка");
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const res = await fetch("/api/admin/blog", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload),
      });
      if (!res.ok) throw new Error("fail");
      setForm(empty);
      setEditId(null);
      await loadPosts();
    } catch {
      setError("Не удалось сохранить статью");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить статью?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/blog?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await loadPosts();
    } finally {
      setBusy(false);
    }
  }

  const modelMissing =
    Boolean(settings?.model) &&
    models.length > 0 &&
    !models.some((m) => m.id === settings?.model);

  const canSync = Boolean(settings?.model?.trim() && settings?.rewritePrompt?.trim());

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Новости"
        description="AI-импорт RBC Crypto → рерайт через codex.sale → публикация на /blog"
      />
      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {settingsMsg ? (
        <p className="rounded-2xl border border-line bg-bg-elevated px-4 py-3 text-sm text-ink-muted">
          {settingsMsg}
        </p>
      ) : null}

      <AdminSection title="Автоимпорт">
        <div className="grid gap-4 p-5">
          <label className="grid gap-1 text-sm">
            <span className="text-ink-muted">Модель codex.sale</span>
            <div className="flex flex-wrap gap-2">
              <select
                className="min-w-[220px] flex-1 rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
                value={settings?.model ?? ""}
                disabled={busy || !settings}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, model: e.target.value } : s,
                  )
                }
              >
                <option value="">— выберите модель —</option>
                {settings?.model &&
                !models.some((m) => m.id === settings.model) ? (
                  <option value={settings.model}>{settings.model} (нет в списке)</option>
                ) : null}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                onClick={() => void loadModels()}
              >
                Обновить список
              </button>
              <button
                type="button"
                disabled={busy || !settings}
                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                onClick={() =>
                  void saveSettings({ model: settings?.model ?? "" })
                }
              >
                Сохранить модель
              </button>
            </div>
            {modelsError ? (
              <span className="text-xs text-danger">{modelsError}</span>
            ) : null}
            {modelMissing ? (
              <span className="text-xs text-danger">
                Сохранённая модель отсутствует в каталоге — выберите другую.
              </span>
            ) : null}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(settings?.enabled)}
              disabled={busy || !settings}
              onChange={(e) =>
                void saveSettings({ enabled: e.target.checked })
              }
            />
            <span>Автосинк раз в сутки</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-ink-muted">Промпт рерайта</span>
            <textarea
              className="min-h-[220px] rounded-2xl border border-line bg-input px-3 py-2.5 font-mono text-xs leading-relaxed"
              value={settings?.rewritePrompt ?? ""}
              disabled={busy || !settings}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, rewritePrompt: e.target.value } : s,
                )
              }
            />
            <span className="text-xs text-ink-muted">
              Плейсхолдеры: {placeholders.join(" · ") || "{{title}} {{body}} …"}
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !settings}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
              onClick={() =>
                void saveSettings({
                  rewritePrompt: settings?.rewritePrompt ?? "",
                })
              }
            >
              Сохранить промпт
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border border-line px-4 py-2.5 text-sm"
              onClick={() => void saveSettings({ resetPrompt: true })}
            >
              Сбросить промпт
            </button>
            <button
              type="button"
              disabled={busy || !canSync}
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent-deep"
              onClick={() => void runSync()}
            >
              Синхронизировать сейчас
            </button>
          </div>

          {defaultPrompt && settings?.rewritePrompt === defaultPrompt ? (
            <p className="text-xs text-ink-muted">Сейчас используется дефолтный промпт.</p>
          ) : null}

          {syncResult ? (
            <div className="rounded-2xl border border-line bg-bg-elevated px-4 py-3 text-xs text-ink-muted">
              <p>
                Последний синк:{" "}
                {new Date(syncResult.syncedAt).toLocaleString("ru-RU")} · fetched{" "}
                {syncResult.fetched} · created {syncResult.created} · skipped{" "}
                {syncResult.skipped} · failed {syncResult.failed}
              </p>
              {syncResult.errors?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-danger">
                  {syncResult.errors.slice(0, 5).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection title={editId ? "Редактирование" : "Новая статья"}>
        <form onSubmit={(e) => void onSave(e)} className="grid gap-3 p-5">
          <input
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
            placeholder="Заголовок"
            required
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          />
          <input
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
            placeholder="Slug (необязательно)"
            value={form.slug}
            onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
          />
          <textarea
            className="min-h-[72px] rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
            placeholder="Краткое описание"
            value={form.excerpt}
            onChange={(e) =>
              setForm((s) => ({ ...s, excerpt: e.target.value }))
            }
          />
          <textarea
            className="min-h-[180px] rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
            placeholder="Текст (markdown: ## заголовки, списки, ссылки)"
            value={form.body}
            onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
          />
          <input
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
            placeholder="Cover image URL"
            value={form.coverImageUrl}
            onChange={(e) =>
              setForm((s) => ({ ...s, coverImageUrl: e.target.value }))
            }
          />
          <input
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
            placeholder="Теги через запятую"
            value={form.tags}
            onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
              placeholder="SEO title"
              value={form.seoTitle}
              onChange={(e) =>
                setForm((s) => ({ ...s, seoTitle: e.target.value }))
              }
            />
            <input
              className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
              placeholder="SEO description"
              value={form.seoDescription}
              onChange={(e) =>
                setForm((s) => ({ ...s, seoDescription: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
              placeholder="Автор"
              value={form.authorName}
              onChange={(e) =>
                setForm((s) => ({ ...s, authorName: e.target.value }))
              }
            />
            <select
              className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  status: e.target.value as "draft" | "published",
                }))
              }
            >
              <option value="draft">Черновик</option>
              <option value="published">Опубликовано</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Сохранить
            </button>
            {editId ? (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setForm(empty);
                }}
                className="rounded-xl border border-line px-4 py-2.5 text-sm"
              >
                Отмена
              </button>
            ) : null}
          </div>
        </form>
      </AdminSection>

      <AdminSection title={`Статьи (${posts.length})`}>
        <div className="divide-y divide-line">
          {posts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{p.title}</p>
                <p className="text-xs text-ink-muted">/blog/{p.slug}</p>
                {p.sourceUrl ? (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-deep hover:underline"
                  >
                    источник
                  </a>
                ) : null}
                <div className="mt-1">
                  <StatusPill
                    status={p.status === "published" ? "active" : "hidden"}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-semibold"
                  onClick={() => {
                    setEditId(p.id);
                    setForm({
                      title: p.title,
                      slug: p.slug,
                      excerpt: p.excerpt,
                      body: p.body,
                      coverImageUrl: p.coverImageUrl,
                      tags: p.tags.join(", "),
                      status: p.status,
                      seoTitle: p.seoTitle,
                      seoDescription: p.seoDescription,
                      authorName: p.authorName,
                    });
                  }}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                  onClick={() => void remove(p.id)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
