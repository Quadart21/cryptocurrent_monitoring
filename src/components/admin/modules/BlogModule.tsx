"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection, StatusPill } from "@/components/admin/ui";
import type { BlogPost } from "@/lib/store-types";

const empty: {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  authorName: string;
} = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
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

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/blog", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { posts: BlogPost[] };
    setPosts(body.posts ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blog", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...form } : form),
      });
      if (!res.ok) throw new Error("fail");
      setForm(empty);
      setEditId(null);
      await load();
    } catch {
      setError("Не удалось сохранить");
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
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Блог"
        description="SEO-статьи: черновики и публикация на /blog"
      />
      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

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
            className="min-h-[160px] rounded-2xl border border-line bg-input px-3 py-2.5 text-sm"
            placeholder="Текст (абзацы через пустую строку)"
            value={form.body}
            onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
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
              <div>
                <p className="font-semibold text-ink">{p.title}</p>
                <p className="text-xs text-ink-muted">/blog/{p.slug}</p>
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
