"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { LegalSettings } from "@/lib/store-types";
import {
  AdminPageHeader,
  AdminSection,
} from "@/components/admin/ui";

const emptyLegal = (): LegalSettings => ({
  privacyTitle: "",
  privacyBody: "",
  privacyUpdatedAt: "",
  cookieTitle: "",
  cookieBody: "",
  cookieUpdatedAt: "",
  bannerTitle: "",
  bannerBody: "",
});

export function LegalModule() {
  const [legal, setLegal] = useState<LegalSettings>(emptyLegal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/legal", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { legal: LegalSettings };
    setLegal(data.legal);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/legal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legal),
      });
      const data = (await res.json()) as { legal?: LegalSettings; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить");
        return;
      }
      if (data.legal) setLegal(data.legal);
      setOk("Сохранено");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Правовые документы"
        description="Тексты политик на сайте и плашка согласия на cookies. Markdown: ## заголовки, списки, ссылки."
      />

      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {ok}
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        <AdminSection title="Плашка согласия">
          <div className="space-y-4 p-5">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Заголовок</span>
              <input
                value={legal.bannerTitle}
                onChange={(e) =>
                  setLegal({ ...legal, bannerTitle: e.target.value })
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Текст</span>
              <textarea
                value={legal.bannerBody}
                onChange={(e) =>
                  setLegal({ ...legal, bannerBody: e.target.value })
                }
                rows={3}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>
        </AdminSection>

        <AdminSection title="Политика конфиденциальности (/privacy)">
          <div className="space-y-4 p-5">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Заголовок</span>
              <input
                value={legal.privacyTitle}
                onChange={(e) =>
                  setLegal({ ...legal, privacyTitle: e.target.value })
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">
                Текст (markdown)
                {legal.privacyUpdatedAt
                  ? ` · ред. ${new Date(legal.privacyUpdatedAt).toLocaleString("ru-RU")}`
                  : ""}
              </span>
              <textarea
                value={legal.privacyBody}
                onChange={(e) =>
                  setLegal({ ...legal, privacyBody: e.target.value })
                }
                rows={16}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
            </label>
          </div>
        </AdminSection>

        <AdminSection title="Политика cookies (/cookies)">
          <div className="space-y-4 p-5">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Заголовок</span>
              <input
                value={legal.cookieTitle}
                onChange={(e) =>
                  setLegal({ ...legal, cookieTitle: e.target.value })
                }
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">
                Текст (markdown)
                {legal.cookieUpdatedAt
                  ? ` · ред. ${new Date(legal.cookieUpdatedAt).toLocaleString("ru-RU")}`
                  : ""}
              </span>
              <textarea
                value={legal.cookieBody}
                onChange={(e) =>
                  setLegal({ ...legal, cookieBody: e.target.value })
                }
                rows={16}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
            </label>
          </div>
        </AdminSection>

        <button
          type="submit"
          disabled={busy}
          className="btn-primary rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
