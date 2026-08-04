/** Shared GapSnap transactional / broadcast email chrome. */

export const EMAIL_LAYOUT_VERSION = "v4";

/** Prefer same-origin assets after deploy; ibb kept as fallback in older sends. */
export const EMAIL_BANNER_SRC = "https://gapsnap.org/email/banner.png";
export const EMAIL_CTA_BTN_SRC = "https://gapsnap.org/email/cta-dark.png";
export const EMAIL_DEFAULT_SITE_URL = "https://gapsnap.org";
export const EMAIL_SUPPORT = "support@gapsnap.org";
export const EMAIL_SUPPORT_TELEGRAM = "GapSnapSupport";
export const EMAIL_SUPPORT_TELEGRAM_URL = `https://t.me/${EMAIL_SUPPORT_TELEGRAM}`;

const MARKER = `data-gapsnap-email="${EMAIL_LAYOUT_VERSION}"`;
const ANY_LAYOUT_RE = /data-gapsnap-email="v\d+"/;

export function hasEmailLayout(html: string): boolean {
  return html.includes(`data-gapsnap-email="${EMAIL_LAYOUT_VERSION}"`);
}

export function escapeEmailHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn plain admin/mailbox text into body HTML (paragraphs + line breaks). */
export function plainTextToEmailBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\n{2,}/).filter((p) => p.length > 0);
  return parts
    .map((para, i) => {
      const inner = escapeEmailHtml(para).replace(/\n/g, "<br />");
      const margin = i === parts.length - 1 ? "0" : "0 0 16px";
      return `<p style="margin:${margin}">${inner}</p>`;
    })
    .join("");
}

/** Rough HTML → plain text for multipart/alternative and admin inbox. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Plain text for admin mailbox bubbles: keep real text when it has breaks,
 * otherwise rebuild from HTML so <br>/<p> become newlines.
 */
export function emailBodiesToDisplayText(
  textBody: string,
  htmlBody: string,
): string {
  const text = (textBody ?? "").replace(/\r\n/g, "\n").trim();
  const html = (htmlBody ?? "").trim();
  if (text && (text.includes("\n") || !html)) return text;
  if (html) {
    const fromHtml = htmlToPlainText(html);
    if (fromHtml) return fromHtml;
  }
  return text || "(пусто)";
}

function stripDocumentShell(html: string): string {
  let body = html.trim();
  if (/^<!DOCTYPE/i.test(body) || /^<html[\s>]/i.test(body)) {
    const m = body.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    body = (m?.[1] ?? body)
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .trim();
  }
  return body;
}

/** Pull inner body out of an older GapSnap chrome so we can re-wrap (v3→v4). */
function extractLayoutBody(html: string): string | null {
  if (!ANY_LAYOUT_RE.test(html)) return null;
  const m = html.match(
    /padding:32px 32px 28px;color:#17151f;font-size:15px;line-height:1\.6(?:;[^"]*)?"\s*>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/i,
  );
  return m?.[1]?.trim() ?? null;
}

function applyWrap(
  body: string,
  opts?: Omit<WrapEmailOptions, "body">,
): string {
  return wrapEmailHtml({
    body,
    ctaHref: opts?.ctaHref ?? EMAIL_DEFAULT_SITE_URL,
    ctaAlt: opts?.ctaAlt ?? "Открыть GapSnap",
    ctaKind: opts?.ctaKind ?? "brand",
    siteUrl: opts?.siteUrl ?? EMAIL_DEFAULT_SITE_URL,
    siteLabel: opts?.siteLabel ?? "gapsnap.org",
    supportEmail: opts?.supportEmail,
    afterCta: opts?.afterCta,
  });
}

/**
 * If HTML is already the current branded envelope — leave it.
 * Older GapSnap chrome is upgraded (not nested). Plain body is wrapped.
 */
export function ensureEmailLayout(
  html: string,
  opts?: Omit<WrapEmailOptions, "body">,
): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;
  if (hasEmailLayout(trimmed)) return trimmed;

  // Upgrade v1–v3 (or any prior marker) instead of nesting a second shell.
  const fromOld = extractLayoutBody(trimmed);
  if (fromOld != null) return applyWrap(fromOld, opts);

  let body = stripDocumentShell(trimmed);
  // Bare plain text from admin editors → paragraphs.
  if (body && !/<[a-z][\s\S]*>/i.test(body)) {
    body = plainTextToEmailBody(body);
  }

  return applyWrap(body, opts);
}

/** Plain-text footer matching the branded HTML chrome. */
export function withManualEmailTextFooter(text: string): string {
  const trimmed = text.trim();
  const footer = [
    "—",
    "команда GapSnap",
    EMAIL_DEFAULT_SITE_URL,
    emailTextSupportLine(),
  ].join("\n");
  return trimmed ? `${trimmed}\n\n${footer}` : footer;
}

export function emailHighlight(
  html: string,
  tone: "accent" | "warn" | "danger" = "accent",
): string {
  const styles =
    tone === "danger"
      ? "background:#fef2f2;border:1px solid #fecaca;color:#991b1b"
      : tone === "warn"
        ? "background:#fffbeb;border:1px solid #fde68a;color:#92400e"
        : "background:#f1e9ff;border:1px solid #e2e0ea;color:#5b21b6";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;${styles};border-radius:12px"><tr><td style="padding:16px 18px;font-size:14px;line-height:1.55">${html}</td></tr></table>`;
}

export function emailQuote(html: string): string {
  return `<blockquote style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #6d28d9;background:#f8f7fb;border-radius:0 10px 10px 0;color:#17151f">${html}</blockquote>`;
}

export function emailCodeBlock(html: string): string {
  return `<pre style="margin:0 0 20px;padding:12px;background:#f8f7fb;border:1px solid #e2e0ea;border-radius:10px;overflow:auto;font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-all;color:#17151f">${html}</pre>`;
}

/** Plain-text support line for email templates. */
export function emailTextSupportLine(): string {
  return `Поддержка в Telegram: ${EMAIL_SUPPORT_TELEGRAM_URL} (@${EMAIL_SUPPORT_TELEGRAM})`;
}

export type WrapEmailOptions = {
  /** Inner HTML (paragraphs, lists, highlights). */
  body: string;
  /** CTA button href (may include {{placeholders}}). */
  ctaHref?: string;
  ctaAlt?: string;
  /**
   * `brand` — картинка-кнопка GapSnap.
   * `action` — текстовая CTA (подтвердить, открыть кабинет…).
   */
  ctaKind?: "brand" | "action";
  /** Extra line under the button (e.g. mailto / raw URL). */
  afterCta?: string;
  siteUrl?: string;
  siteLabel?: string;
  supportEmail?: string;
};

/** Full branded envelope: banner, body, CTA, footer. */
export function wrapEmailHtml(opts: WrapEmailOptions): string {
  const siteUrl = opts.siteUrl ?? "{{siteUrl}}";
  const siteLabel = opts.siteLabel ?? "gapsnap.org";
  const support = opts.supportEmail ?? EMAIL_SUPPORT;
  const ctaHref = opts.ctaHref?.trim();
  const ctaAlt = opts.ctaAlt ?? "Открыть GapSnap";
  const ctaKind = opts.ctaKind ?? "brand";

  const afterInner = opts.afterCta?.trim()
    ? `<div style="margin:14px 0 0;font-size:12px;line-height:1.45;color:#6a6578">${opts.afterCta}</div>`
    : "";

  const ctaControl =
    ctaKind === "action"
      ? `<a href="${ctaHref}" target="_blank" style="display:inline-block;padding:14px 28px;background:#16141f;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;line-height:1.2;border:0;outline:none">${ctaAlt}</a>`
      : `<a href="${ctaHref}" target="_blank" style="display:inline-block;line-height:0;text-decoration:none;border:0;outline:none">
                <img src="${EMAIL_CTA_BTN_SRC}" alt="${ctaAlt}" width="176" height="62" style="display:block;width:176px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none" />
              </a>`;

  const ctaBand = ctaHref
    ? `<tr>
            <td align="center" style="padding:4px 32px 30px;background:#ffffff">
              <div style="height:1px;line-height:1px;font-size:1px;background:#e2e0ea;margin:0 0 24px">&nbsp;</div>
              ${ctaControl}
              ${afterInner}
            </td>
          </tr>`
    : opts.afterCta?.trim()
      ? `<tr>
            <td align="center" style="padding:0 32px 28px;background:#ffffff">
              ${afterInner}
            </td>
          </tr>`
      : "";

  // Full document + charset: fragment-only Cyrillic HTML often fails in Gmail/Outlook
  // ("This message could not be displayed").
  return `<!DOCTYPE html>
<html lang="ru" dir="ltr">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GapSnap</title>
</head>
<body style="margin:0;padding:0;background:#f6f5f8;">
<div ${MARKER} lang="ru" dir="ltr" style="margin:0;padding:0;background:#f6f5f8;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f8;padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e2e0ea">
          <tr>
            <td style="padding:0;line-height:0;font-size:0;background:#0d0c12">
              <img src="${EMAIL_BANNER_SRC}" alt="GapSnap — мониторинг обменников" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;color:#17151f;font-size:15px;line-height:1.6;font-family:Arial,Helvetica,sans-serif">
              ${opts.body}
            </td>
          </tr>
          ${ctaBand}
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #e2e0ea;background:#eeeef3;font-family:Arial,Helvetica,sans-serif">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6a6578">
                С уважением,<br />
                <strong style="color:#17151f">команда GapSnap</strong>
              </p>
              <p style="margin:10px 0 0;font-size:12px;color:#6a6578">
                <a href="${siteUrl}" style="color:#6a6578;text-decoration:none">${siteLabel}</a>
                &nbsp;·&nbsp;
                <a href="mailto:${support}" style="color:#6a6578;text-decoration:none">${support}</a>
                &nbsp;·&nbsp;
                <a href="${EMAIL_SUPPORT_TELEGRAM_URL}" style="color:#6a6578;text-decoration:none">Telegram @${EMAIL_SUPPORT_TELEGRAM}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;
}

/**
 * Default body HTML for admin compose / broadcast.
 * Branded chrome is applied on send via `ensureEmailLayout`.
 */
export function defaultComposeHtml(kind: "compose" | "broadcast"): string {
  return kind === "broadcast"
    ? `<p style="margin:0 0 16px">Здравствуйте!</p>
<p style="margin:0 0 16px">Новости <strong style="color:#6d28d9">GapSnap</strong>.</p>
<p style="margin:0;color:#6a6578">Кратко расскажем, что изменилось, и чем это полезно вам.</p>`
    : `<p style="margin:0 0 16px">Здравствуйте!</p>
<p style="margin:0 0 16px">Сообщение от <strong style="color:#6d28d9">GapSnap</strong>.</p>
<p style="margin:0;color:#6a6578">Если появятся вопросы — мы на связи и с радостью поможем.</p>`;
}
