"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection } from "@/components/admin/ui";
import {
  SITE_ASSET_KINDS,
  siteAssetAccept,
  siteAssetHint,
  siteAssetLabel,
  type SiteAssetKind,
  type SiteAssetMeta,
} from "@/lib/branding-url";

type AssetRow = {
  kind: SiteAssetKind;
  meta: SiteAssetMeta | null;
  url: string | null;
};

export function BrandingModule() {
  const { busy, setBusy, can } = useAdmin();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<SiteAssetKind | null>(null);

  const canWrite = can("branding.write");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/branding", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { assets: AssetRow[] };
    setAssets(data.assets);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(kind: SiteAssetKind, file: File) {
    setBusy(true);
    setPendingKind(kind);
    setError(null);
    setOk(null);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as {
        error?: string;
        assets?: AssetRow[];
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось загрузить файл");
        return;
      }
      if (body.assets) setAssets(body.assets);
      setOk(`${siteAssetLabel(kind)} обновлён`);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
      setPendingKind(null);
    }
  }

  async function remove(kind: SiteAssetKind) {
    if (!confirm(`Удалить «${siteAssetLabel(kind)}» и вернуть значение по умолчанию?`)) {
      return;
    }
    setBusy(true);
    setPendingKind(kind);
    setError(null);
    setOk(null);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("remove", "1");
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as {
        error?: string;
        assets?: AssetRow[];
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось удалить");
        return;
      }
      if (body.assets) setAssets(body.assets);
      setOk(`${siteAssetLabel(kind)} сброшен`);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
      setPendingKind(null);
    }
  }

  const rows =
    assets.length > 0
      ? assets
      : SITE_ASSET_KINDS.map((kind) => ({
          kind,
          meta: null,
          url: null,
        }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Брендинг"
        description="Логотип, фавиконы и OG-картинка. Загрузите файлы с компьютера — они сразу появятся на сайте."
      />

      {(error || ok) && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-ok/30 bg-ok/10 text-ok"
          }`}
        >
          {error ?? ok}
        </p>
      )}

      <AdminSection
        title="Ключевые изображения"
        description="Логотип используется в шапке, подвале и мобильном меню. Загрузка OG также обновляет SEO Open Graph, если URL не задан вручную."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const previewUrl =
              row.url ??
              (row.kind === "logo"
                ? "/gapsnap-mark.png"
                : row.kind === "icon" ||
                    row.kind === "apple_icon" ||
                    row.kind === "favicon"
                  ? `/api/branding/${row.kind}`
                  : null);
            const isOg = row.kind === "og_image";
            const busyRow = busy && pendingKind === row.kind;

            return (
              <div
                key={row.kind}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-bg-soft/30 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {siteAssetLabel(row.kind)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {siteAssetHint(row.kind)}
                  </p>
                </div>

                <div
                  className={`flex items-center justify-center rounded-xl border border-dashed border-line bg-bg ${
                    isOg ? "aspect-[1.91/1] w-full" : "h-24 w-24"
                  }`}
                >
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={siteAssetLabel(row.kind)}
                      className={`object-contain ${
                        isOg ? "max-h-full max-w-full p-2" : "max-h-16 max-w-16"
                      }`}
                    />
                  ) : (
                    <span className="px-2 text-center text-xs text-ink-muted">
                      Не задано
                    </span>
                  )}
                </div>

                <div className="mt-auto space-y-2">
                  {row.meta ? (
                    <p className="text-[11px] text-ink-muted">
                      {row.meta.format.toUpperCase()} ·{" "}
                      {new Date(row.meta.updatedAt).toLocaleString("ru-RU")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink-muted">По умолчанию</p>
                  )}

                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-xl border border-line bg-input px-3 py-2 text-xs font-semibold text-ink hover:bg-bg-soft">
                        {busyRow ? "Загрузка…" : "Загрузить с ПК"}
                        <input
                          type="file"
                          accept={siteAssetAccept(row.kind)}
                          className="sr-only"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void upload(row.kind, file);
                          }}
                        />
                      </label>
                      {row.meta ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void remove(row.kind)}
                          className="rounded-xl border border-danger/30 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                        >
                          Сбросить
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">Только просмотр</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AdminSection>
    </div>
  );
}
