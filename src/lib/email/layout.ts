/** Shared GapSnap transactional / broadcast email chrome. */

export const EMAIL_LAYOUT_VERSION = "v3";

/** Prefer same-origin assets after deploy; ibb kept as fallback in older sends. */
export const EMAIL_BANNER_SRC = "https://gapsnap.org/email/banner.png";
export const EMAIL_CTA_BTN_SRC = "https://gapsnap.org/email/cta-dark.png";
export const EMAIL_DEFAULT_SITE_URL = "https://gapsnap.org";
export const EMAIL_SUPPORT = "support@gapsnap.org";
export const EMAIL_SUPPORT_TELEGRAM = "GapSnapSupport";
export const EMAIL_SUPPORT_TELEGRAM_URL = `https://t.me/${EMAIL_SUPPORT_TELEGRAM}`;

const MARKER = `data-gapsnap-email="${EMAIL_LAYOUT_VERSION}"`;

export function hasEmailLayout(html: string): boolean {
  return html.includes(`data-gapsnap-email="${EMAIL_LAYOUT_VERSION}"`);
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

  return `<div ${MARKER} style="margin:0;padding:0;background:#f6f5f8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f8;padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e0ea">
          <tr>
            <td style="padding:0;line-height:0;font-size:0;background:#0d0c12">
              <img src="${EMAIL_BANNER_SRC}" alt="GapSnap — мониторинг обменников" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;color:#17151f;font-size:15px;line-height:1.6">
              ${opts.body}
            </td>
          </tr>
          ${ctaBand}
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #e2e0ea;background:#eeeef3">
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
</div>`;
}

/** Default HTML for admin compose / broadcast (literal site URL). */
export function defaultComposeHtml(kind: "compose" | "broadcast"): string {
  const intro =
    kind === "broadcast"
      ? `<p style="margin:0 0 16px">Здравствуйте!</p>
              <p style="margin:0 0 16px">Новости <strong style="color:#6d28d9">GapSnap</strong>.</p>
              <p style="margin:0;color:#6a6578">Кратко расскажем, что изменилось, и чем это полезно вам.</p>`
      : `<p style="margin:0 0 16px">Здравствуйте!</p>
              <p style="margin:0 0 16px">Сообщение от <strong style="color:#6d28d9">GapSnap</strong>.</p>
              <p style="margin:0;color:#6a6578">Если появятся вопросы — мы на связи и с радостью поможем.</p>`;

  return wrapEmailHtml({
    body: intro,
    ctaHref: EMAIL_DEFAULT_SITE_URL,
    ctaAlt: "Открыть GapSnap",
    siteUrl: EMAIL_DEFAULT_SITE_URL,
    siteLabel: "gapsnap.org",
  });
}
