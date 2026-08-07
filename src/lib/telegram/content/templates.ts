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

export function buildSpreadDraft(input: {
  payload: SpreadPayload;
  siteName: string;
  siteUrl: string;
}): { text: string; buttons: TelegramButtonRow[]; topic: string } {
  const { payload, siteName, siteUrl } = input;
  const fromL = currencyLabel(payload.from);
  const toL = currencyLabel(payload.to);
  const spread = payload.spreadPct.toFixed(2);
  const best = formatRate(payload.bestRate);
  const worst = formatRate(payload.worstRate);
  const url = `${siteUrl.replace(/\/+$/, "")}${payload.pairPath}?utm_source=telegram&utm_medium=channel&utm_campaign=spread`;

  const text = [
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
    text,
    buttons: [[{ text: "Смотреть курсы", url }]],
    topic: `[spread] ${payload.from} → ${payload.to} · ${spread}%`,
  };
}

export function buildNewsDraft(input: {
  payload: NewsPayload;
  siteName: string;
  siteUrl: string;
}): {
  text: string;
  buttons: TelegramButtonRow[];
  topic: string;
  photoUrl: string;
} {
  const { payload, siteName, siteUrl } = input;
  const url = `${siteUrl.replace(/\/+$/, "")}${payload.blogPath}?utm_source=telegram&utm_medium=channel&utm_campaign=news`;
  const excerpt = payload.excerpt.trim().slice(0, 500);
  const title = payload.title.trim().slice(0, 200);

  const lines = [
    `<b>${escapeTelegramHtml(title)}</b>`,
    "",
  ];
  if (excerpt) {
    lines.push(escapeTelegramHtml(excerpt));
    lines.push("");
  }
  lines.push(`Читать на ${escapeTelegramHtml(siteName)} ↓`);

  let photoUrl = (payload.coverImageUrl || "").trim();
  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
    const base = siteUrl.replace(/\/+$/, "");
    photoUrl = `${base}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`;
  }

  return {
    text: lines.join("\n"),
    buttons: [[{ text: "Читать статью", url }]],
    topic: `[news] ${title}`,
    photoUrl,
  };
}
