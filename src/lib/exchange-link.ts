/**
 * Build outbound exchange URL for the monitoring pair.
 * Template placeholders: `{0}` = from (отдаёте), `{1}` = to (получаете).
 * Codes are feed tickers (ACRUB, BTC, USDTTRC20, …).
 * Falls back to `website` when the template is empty.
 */
export function buildExchangeUrl(
  template: string | null | undefined,
  website: string | null | undefined,
  from: string,
  to: string,
): string {
  const fromCode = String(from ?? "").trim().toUpperCase();
  const toCode = String(to ?? "").trim().toUpperCase();
  const tpl = String(template ?? "").trim();
  const site = String(website ?? "").trim();

  if (tpl && fromCode && toCode) {
    return tpl.replaceAll("{0}", fromCode).replaceAll("{1}", toCode);
  }
  return site || "#";
}

/** Soft validation for apply/admin forms. Empty is allowed (fallback to website). */
export function validateExchangeUrlTemplate(
  template: string,
): string | null {
  const tpl = template.trim();
  if (!tpl) return null;
  if (!tpl.includes("{0}") || !tpl.includes("{1}")) {
    return "В шаблоне нужны плейсхолдеры {0} (отдаёте) и {1} (получаете)";
  }
  if (!/^https?:\/\//i.test(tpl)) {
    return "Шаблон должен начинаться с https://";
  }
  const sample = tpl.replaceAll("{0}", "BTC").replaceAll("{1}", "USDTTRC20");
  try {
    const u = new URL(sample);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "Некорректный URL шаблона";
    }
  } catch {
    return "Некорректный URL шаблона";
  }
  return null;
}
