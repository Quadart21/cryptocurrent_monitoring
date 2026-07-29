"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { SeoSettings } from "@/lib/store-types";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
} from "@/components/admin/ui";

const emptySeo: SeoSettings = {
  siteName: "",
  siteUrl: "",
  titleDefault: "",
  titleTemplate: "",
  description: "",
  keywords: "",
  ogTitle: "",
  ogDescription: "",
  ogImageUrl: "",
  twitterCard: "summary_large_image",
  twitterHandle: "",
  robotsIndex: true,
  robotsFollow: true,
  robotsExtra: "",
  robotsTxtExtra: "",
  sitemapEnabled: true,
  noindexPaths: "",
  googleVerification: "",
  yandexVerification: "",
  bingVerification: "",
  jsonLdEnabled: true,
  organizationName: "",
  organizationLogoUrl: "",
  googleAnalyticsId: "",
  yandexMetricaId: "",
  gtmId: "",
};

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

const inputClass =
  "w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const areaClass = `${inputClass} min-h-[88px] resize-y`;

export function SeoModule() {
  const { busy, setBusy } = useAdmin();
  const [seo, setSeo] = useState<SeoSettings>(emptySeo);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/seo", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { seo: SeoSettings };
    setSeo(data.seo);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch<K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) {
    setSeo((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seo),
      });
      if (!res.ok) throw new Error("fail");
      const data = (await res.json()) as { seo: SeoSettings };
      setSeo(data.seo);
      setOk("SEO-настройки сохранены");
    } catch {
      setError("Не удалось сохранить настройки");
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = seo.siteUrl.trim().replace(/\/+$/, "") || "https://example.com";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="SEO"
        description="Заголовки, Open Graph, robots.txt, sitemap и коды верификации поисковиков. После сохранения проверьте /robots.txt и /sitemap.xml."
      />

      {(error || ok) && (
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            error ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"
          }`}
        >
          {error ?? ok}
        </p>
      )}

      <form onSubmit={onSave} className="space-y-6">
        <AdminSection title="Основные метаданные">
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <Field label="Название сайта" hint="Бренд в title и Open Graph">
              <input
                className={inputClass}
                value={seo.siteName}
                onChange={(e) => patch("siteName", e.target.value)}
              />
            </Field>
            <Field
              label="URL сайта"
              hint="Обязательно для sitemap.xml (или SITE_URL в .env). Пример: https://gapsnap.org"
            >
              <input
                className={inputClass}
                placeholder="https://gapsnap.org"
                value={seo.siteUrl}
                onChange={(e) => patch("siteUrl", e.target.value)}
              />
            </Field>
            <Field label="Title по умолчанию" hint="Главная и страницы без своего title">
              <input
                className={inputClass}
                value={seo.titleDefault}
                onChange={(e) => patch("titleDefault", e.target.value)}
              />
            </Field>
            <Field
              label="Шаблон title"
              hint="Обязательно %s — подставится заголовок страницы"
            >
              <input
                className={inputClass}
                value={seo.titleTemplate}
                onChange={(e) => patch("titleTemplate", e.target.value)}
              />
            </Field>
            <div className="lg:col-span-2">
              <Field label="Description" hint="До ~160 символов для сниппета">
                <textarea
                  className={areaClass}
                  value={seo.description}
                  onChange={(e) => patch("description", e.target.value)}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  {seo.description.length} символов
                </p>
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field label="Keywords" hint="Через запятую">
                <input
                  className={inputClass}
                  value={seo.keywords}
                  onChange={(e) => patch("keywords", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </AdminSection>

        <AdminSection title="Open Graph и Twitter">
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <Field label="OG Title" hint="Пусто = взять обычный title">
              <input
                className={inputClass}
                value={seo.ogTitle}
                onChange={(e) => patch("ogTitle", e.target.value)}
              />
            </Field>
            <Field label="Twitter card">
              <select
                className={inputClass}
                value={seo.twitterCard}
                onChange={(e) =>
                  patch(
                    "twitterCard",
                    e.target.value as SeoSettings["twitterCard"],
                  )
                }
              >
                <option value="summary_large_image">Большая картинка</option>
                <option value="summary">Квадратный превью</option>
              </select>
            </Field>
            <div className="lg:col-span-2">
              <Field label="OG Description">
                <textarea
                  className={areaClass}
                  value={seo.ogDescription}
                  onChange={(e) => patch("ogDescription", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="OG Image URL"
              hint="Полный URL или путь от корня сайта, напр. /og.png"
            >
              <input
                className={inputClass}
                value={seo.ogImageUrl}
                onChange={(e) => patch("ogImageUrl", e.target.value)}
              />
            </Field>
            <Field label="Twitter / X handle" hint="@gapsnap или gapsnap">
              <input
                className={inputClass}
                value={seo.twitterHandle}
                onChange={(e) => patch("twitterHandle", e.target.value)}
              />
            </Field>
          </div>
        </AdminSection>

        <AdminSection title="Индексация (robots)">
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={seo.robotsIndex}
                onChange={(e) => patch("robotsIndex", e.target.checked)}
              />
              <span>
                <span className="font-semibold">Разрешить индексацию</span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  index / noindex
                </span>
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={seo.robotsFollow}
                onChange={(e) => patch("robotsFollow", e.target.checked)}
              />
              <span>
                <span className="font-semibold">Переходить по ссылкам</span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  follow / nofollow
                </span>
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm lg:col-span-2">
              <input
                type="checkbox"
                checked={seo.sitemapEnabled}
                onChange={(e) => patch("sitemapEnabled", e.target.checked)}
              />
              <span>
                <span className="font-semibold">Включить sitemap.xml</span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Ссылка появится в robots.txt: {previewUrl}/sitemap.xml
                </span>
              </span>
            </label>
            <div className="lg:col-span-2">
              <Field
                label="Доп. директивы robots meta"
                hint="Через запятую, например max-image-preview:large, max-snippet:-1"
              >
                <input
                  className={inputClass}
                  value={seo.robotsExtra}
                  onChange={(e) => patch("robotsExtra", e.target.value)}
                />
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field
                label="Disallow в robots.txt"
                hint="По одному пути на строку. Путь админки сюда не пишите — он светится в robots.txt. /api/ добавляется автоматически."
              >
                <textarea
                  className={areaClass}
                  value={seo.noindexPaths}
                  onChange={(e) => patch("noindexPaths", e.target.value)}
                />
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field
                label="Доп. строки robots.txt"
                hint="Например Host: gapsnap.ru или Crawl-delay"
              >
                <textarea
                  className={areaClass}
                  value={seo.robotsTxtExtra}
                  onChange={(e) => patch("robotsTxtExtra", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </AdminSection>

        <AdminSection title="Верификация поисковиков">
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <Field label="Google" hint="content из meta google-site-verification">
              <input
                className={inputClass}
                value={seo.googleVerification}
                onChange={(e) => patch("googleVerification", e.target.value)}
              />
            </Field>
            <Field label="Яндекс" hint="yandex-verification">
              <input
                className={inputClass}
                value={seo.yandexVerification}
                onChange={(e) => patch("yandexVerification", e.target.value)}
              />
            </Field>
            <Field label="Bing" hint="msvalidate.01">
              <input
                className={inputClass}
                value={seo.bingVerification}
                onChange={(e) => patch("bingVerification", e.target.value)}
              />
            </Field>
          </div>
        </AdminSection>

        <AdminSection title="JSON-LD (Organization)">
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm lg:col-span-2">
              <input
                type="checkbox"
                checked={seo.jsonLdEnabled}
                onChange={(e) => patch("jsonLdEnabled", e.target.checked)}
              />
              <span className="font-semibold">
                Выводить schema.org Organization в &lt;head&gt;
              </span>
            </label>
            <Field label="Название организации">
              <input
                className={inputClass}
                value={seo.organizationName}
                onChange={(e) => patch("organizationName", e.target.value)}
              />
            </Field>
            <Field label="URL логотипа">
              <input
                className={inputClass}
                value={seo.organizationLogoUrl}
                onChange={(e) => patch("organizationLogoUrl", e.target.value)}
              />
            </Field>
          </div>
        </AdminSection>

        <AdminSection title="Аналитика">
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <Field label="Google Analytics 4" hint="G-XXXXXXXX">
              <input
                className={inputClass}
                value={seo.googleAnalyticsId}
                onChange={(e) => patch("googleAnalyticsId", e.target.value)}
              />
            </Field>
            <Field label="Яндекс.Метрика" hint="числовой ID счётчика">
              <input
                className={inputClass}
                value={seo.yandexMetricaId}
                onChange={(e) => patch("yandexMetricaId", e.target.value)}
              />
            </Field>
            <Field label="Google Tag Manager" hint="GTM-XXXX">
              <input
                className={inputClass}
                value={seo.gtmId}
                onChange={(e) => patch("gtmId", e.target.value)}
              />
            </Field>
          </div>
        </AdminSection>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="btn-primary rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Сохранение…" : "Сохранить SEO"}
          </button>
          <a
            href="/robots.txt"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted hover:border-accent hover:text-ink"
          >
            Открыть robots.txt
          </a>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted hover:border-accent hover:text-ink"
          >
            Открыть sitemap.xml
          </a>
        </div>
      </form>
    </div>
  );
}
