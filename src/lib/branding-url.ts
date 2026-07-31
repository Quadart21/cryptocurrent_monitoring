export const SITE_ASSET_KINDS = [
  "logo",
  "icon",
  "apple_icon",
  "favicon",
  "og_image",
] as const;

export type SiteAssetKind = (typeof SITE_ASSET_KINDS)[number];

export type SiteAssetFormat = "png" | "svg" | "jpeg" | "webp" | "ico";

export type SiteAssetMeta = {
  kind: SiteAssetKind;
  format: SiteAssetFormat;
  updatedAt: string;
};

export function isSiteAssetKind(value: string): value is SiteAssetKind {
  return (SITE_ASSET_KINDS as readonly string[]).includes(value);
}

export function isSiteAssetFormat(value: string | null | undefined): value is SiteAssetFormat {
  return (
    value === "png" ||
    value === "svg" ||
    value === "jpeg" ||
    value === "webp" ||
    value === "ico"
  );
}

export function brandingPublicUrl(
  kind: SiteAssetKind,
  meta: SiteAssetMeta | null | undefined,
): string | null {
  if (!meta) return null;
  return `/api/branding/${encodeURIComponent(kind)}?v=${encodeURIComponent(meta.updatedAt)}`;
}

export function brandingContentType(format: SiteAssetFormat): string {
  switch (format) {
    case "svg":
      return "image/svg+xml; charset=utf-8";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "ico":
      return "image/x-icon";
    case "png":
    default:
      return "image/png";
  }
}

/** Default public mark when no custom logo uploaded. */
export const DEFAULT_BRAND_LOGO_PATH = "/gapsnap-mark.png";

export function siteAssetLabel(kind: SiteAssetKind): string {
  switch (kind) {
    case "logo":
      return "Логотип сайта";
    case "icon":
      return "Favicon";
    case "apple_icon":
      return "Apple Touch Icon";
    case "favicon":
      return "Favicon (.ico)";
    case "og_image":
      return "OG-изображение";
    default:
      return kind;
  }
}

export function siteAssetHint(kind: SiteAssetKind): string {
  switch (kind) {
    case "logo":
      return "Шапка, подвал и мобильное меню. SVG или PNG (желательно с прозрачностью), до 1 МБ.";
    case "icon":
      return "Иконка вкладки браузера. PNG/JPEG/WebP/SVG — сохраним как PNG 32×32.";
    case "apple_icon":
      return "Иконка на домашнем экране iOS. PNG/JPEG/WebP/SVG — сохраним как PNG 180×180.";
    case "favicon":
      return "Классический favicon.ico (или PNG — конвертируем). Опционально поверх icon.";
    case "og_image":
      return "Превью в соцсетях и мессенджерах. Рекомендуем 1200×630, PNG/JPEG/WebP до 3 МБ.";
    default:
      return "";
  }
}

export function siteAssetAccept(kind: SiteAssetKind): string {
  switch (kind) {
    case "logo":
      return "image/svg+xml,image/png,image/jpeg,image/webp,.svg,.png,.jpg,.jpeg,.webp";
    case "favicon":
      return "image/x-icon,image/vnd.microsoft.icon,image/png,image/jpeg,image/webp,image/svg+xml,.ico,.png,.svg";
    case "icon":
    case "apple_icon":
      return "image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg";
    case "og_image":
      return "image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg";
    default:
      return "image/*";
  }
}
