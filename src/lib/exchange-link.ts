/**
 * Build outbound exchange URL for the monitoring pair.
 * Priority: referralUrlTemplate → exchangeUrlTemplate → website.
 * Placeholders: `{0}` = from, `{1}` = to (feed tickers).
 * A referral URL without placeholders is used as-is for any pair.
 */
export function buildExchangeUrl(
  template: string | null | undefined,
  website: string | null | undefined,
  from: string,
  to: string,
  referralUrlTemplate?: string | null | undefined,
): string {
  const fromCode = String(from ?? "").trim().toUpperCase();
  const toCode = String(to ?? "").trim().toUpperCase();
  const referral = String(referralUrlTemplate ?? "").trim();
  const tpl = String(template ?? "").trim();
  const site = String(website ?? "").trim();

  const filled = fillPairTemplate(referral, fromCode, toCode);
  if (filled) return filled;

  const filledExchange = fillPairTemplate(tpl, fromCode, toCode);
  if (filledExchange) return filledExchange;

  // Plain referral (no placeholders) wins over website for the exchange button.
  if (referral && !hasPairPlaceholders(referral)) return referral;

  return site || "#";
}

/** Homepage / "Перейти на сайт" — prefer plain referral URL, else website. */
export function buildExchangerSiteUrl(
  website: string | null | undefined,
  referralUrlTemplate?: string | null | undefined,
): string {
  const referral = String(referralUrlTemplate ?? "").trim();
  if (referral && !hasPairPlaceholders(referral)) return referral;
  return String(website ?? "").trim() || "#";
}

function hasPairPlaceholders(url: string): boolean {
  return url.includes("{0}") || url.includes("{1}");
}

function fillPairTemplate(
  template: string,
  fromCode: string,
  toCode: string,
): string | null {
  if (!template) return null;
  if (!hasPairPlaceholders(template)) return null;
  if (!fromCode || !toCode) return null;
  return template.replaceAll("{0}", fromCode).replaceAll("{1}", toCode);
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

/**
 * Referral link for GapSnap: either a plain https URL with partner id,
 * or a pair template with {0}/{1} (same rules as exchange template).
 */
export function validateReferralUrlTemplate(
  template: string,
): string | null {
  const tpl = template.trim();
  if (!tpl) return null;
  if (!/^https?:\/\//i.test(tpl)) {
    return "Реферальная ссылка должна начинаться с https://";
  }
  const has0 = tpl.includes("{0}");
  const has1 = tpl.includes("{1}");
  if (has0 !== has1) {
    return "Нужны оба плейсхолдера {0} и {1}, либо обычный URL без них";
  }
  const sample = has0
    ? tpl.replaceAll("{0}", "BTC").replaceAll("{1}", "USDTTRC20")
    : tpl;
  try {
    const u = new URL(sample);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "Некорректный URL";
    }
  } catch {
    return "Некорректный URL";
  }
  return null;
}
