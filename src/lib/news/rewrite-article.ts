import "server-only";

import { chatCompletion } from "@/lib/ai/codex-client";
import type { RbcCryptoNewsItem } from "@/lib/news/rbc-crypto";

export type RewrittenArticle = {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  bodyMarkdown: string;
};

function applyPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Ответ модели не содержит JSON");
  }
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
}

export function parseRewrittenArticle(raw: string): RewrittenArticle {
  const data = extractJsonObject(raw) as Record<string, unknown>;
  const title = asString(data.title);
  const bodyMarkdown = asString(data.bodyMarkdown ?? data.body);
  if (!title || !bodyMarkdown) {
    throw new Error("В JSON нет title или bodyMarkdown");
  }
  return {
    title,
    slug: asString(data.slug),
    excerpt: asString(data.excerpt),
    seoTitle: asString(data.seoTitle) || title,
    seoDescription: asString(data.seoDescription) || asString(data.excerpt),
    tags: asStringArray(data.tags),
    bodyMarkdown,
  };
}

export async function rewriteNewsArticle(input: {
  model: string;
  promptTemplate: string;
  item: RbcCryptoNewsItem;
  siteName: string;
  siteUrl: string;
}): Promise<RewrittenArticle> {
  const rawBody = input.item.bodyText || input.item.fullText;
  // Cap source body — long RBC full-text slows the model a lot
  const body =
    rawBody.length > 4500
      ? `${rawBody.slice(0, 4500)}\n\n[…текст обрезан для рерайта]`
      : rawBody;

  const prompt = applyPlaceholders(input.promptTemplate, {
    title: input.item.title,
    anons: input.item.anons,
    body,
    tags: input.item.tags.join(", "),
    sourceUrl: input.item.link,
    siteName: input.siteName,
    siteUrl: input.siteUrl.replace(/\/+$/, ""),
  });

  const t0 = Date.now();
  const raw = await chatCompletion({
    model: input.model,
    messages: [
      {
        role: "system",
        content:
          "Ты возвращаешь только валидный JSON-объект по инструкции пользователя. Без пояснений и markdown-обёртки.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.75,
  });
  console.info(
    `[gapsnap] rewrite ok in ${Date.now() - t0}ms model=${input.model} inChars=${prompt.length}`,
  );

  return parseRewrittenArticle(raw);
}
