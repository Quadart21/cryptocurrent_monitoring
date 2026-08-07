import "server-only";

import { currencyLabel } from "@/lib/bestchange/catalog";
import { formatRate } from "@/lib/format";
import type { TelegramButtonRow } from "@/lib/telegram/types";
import type { NewsPayload, SpreadPayload } from "@/lib/telegram/content/types";

export function escapeTelegramHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type ContentTemplateOptions = {
  siteName: string;
  siteUrl: string;
  footer?: string;
  spreadButtonText?: string;
  newsButtonText?: string;
  utmCampaign?: string;
  withNewsImage?: boolean;
};

function appendFooter(text: string, footer?: string): string {
  const f = (footer ?? "").trim();
  if (!f) return text;
  return `${text}\n\n${f}`;
}

function withUtm(
  siteUrl: string,
  path: string,
  campaign: string,
  content: string,
): string {
  const base = siteUrl.replace(/\/+$/, "");
  const camp = encodeURIComponent(campaign.trim() || "content");
  const c = encodeURIComponent(content);
  return `${base}${path}?utm_source=telegram&utm_medium=channel&utm_campaign=${camp}&utm_content=${c}`;
}

export function buildSpreadDraft(input: {
  payload: SpreadPayload;
} & ContentTemplateOptions): {
  text: string;
  buttons: TelegramButtonRow[];
  topic: string;
} {
  const { payload, siteName, siteUrl } = input;
  const fromL = currencyLabel(payload.from);
  const toL = currencyLabel(payload.to);
  const spread = payload.spreadPct.toFixed(2);
  const best = formatRate(payload.bestRate);
  const worst = formatRate(payload.worstRate);
  const url = withUtm(
    siteUrl,
    payload.pairPath,
    input.utmCampaign || "content",
    "spread",
  );
  const btn =
    (input.spreadButtonText || "").trim() || "Смотреть курсы";

  const body = [
    `<b>Разброс ${escapeTelegramHtml(spread)}% — ${escapeTelegramHtml(fromL)} → ${escapeTelegramHtml(toL)}</b>`,
    "",
    `Сейчас в мониторинге ${payload.offerCount} обменников по паре <code>${escapeTelegramHtml(payload.from)}→${escapeTelegramHtml(payload.to)}</code>.`,
    `Лучший курс: <code>${escapeTelegramHtml(best)}</code> ${escapeTelegramHtml(payload.to)}`,
    `Худший курс: <code>${escapeTelegramHtml(worst)}</code> ${escapeTelegramHtml(payload.to)}`,
    "",
    `Разница между крайними предложениями — около <b>${escapeTelegramHtml(spread)}%</b>. Сверяйте курс и резерв перед обменом.`,
    "",
    `Актуальная таблица на ${escapeTelegramHtml(siteName)} ↓`,
  ].join("\n");

  return {
    text: appendFooter(body, input.footer),
    buttons: [[{ text: btn.slice(0, 64), url }]],
    topic: `[spread] ${payload.from} → ${payload.to} · ${spread}%`,
  };
}

export function buildNewsDraft(input: {
  payload: NewsPayload;
} & ContentTemplateOptions): {
  text: string;
  buttons: TelegramButtonRow[];
  topic: string;
  photoUrl: string;
} {
  const { payload, siteName, siteUrl } = input;
  const url = withUtm(
    siteUrl,
    payload.blogPath,
    input.utmCampaign || "content",
    "news",
  );
  const excerpt = payload.excerpt.trim().slice(0, 500);
  const title = payload.title.trim().slice(0, 200);
  const btn = (input.newsButtonText || "").trim() || "Читать статью";

  const lines = [`<b>${escapeTelegramHtml(title)}</b>`, ""];
  if (excerpt) {
    lines.push(escapeTelegramHtml(excerpt));
    lines.push("");
  }
  lines.push(`Читать на ${escapeTelegramHtml(siteName)} ↓`);

  let photoUrl = "";
  if (input.withNewsImage !== false) {
    photoUrl = (payload.coverImageUrl || "").trim();
    if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
      const base = siteUrl.replace(/\/+$/, "");
      photoUrl = `${base}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`;
    }
  }

  return {
    text: appendFooter(lines.join("\n"), input.footer),
    buttons: [[{ text: btn.slice(0, 64), url }]],
    topic: `[news] ${title}`,
    photoUrl,
  };
}
