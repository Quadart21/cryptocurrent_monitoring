import "server-only";

import { chatCompletion } from "@/lib/ai/codex-client";
import { DEFAULT_TELEGRAM_COMPOSE_PROMPT } from "@/lib/telegram/default-prompt";
import type { TelegramParseMode } from "@/lib/telegram/types";

export type ComposedTelegramPost = {
  text: string;
  parseMode: TelegramParseMode;
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

function normalizeParseMode(value: unknown): TelegramParseMode {
  if (value === "MarkdownV2" || value === "Markdown" || value === "HTML") {
    return value;
  }
  return "HTML";
}

export function parseComposedTelegramPost(raw: string): ComposedTelegramPost {
  // Prefer JSON; fall back to raw HTML/text if the model ignored the schema.
  try {
    const data = extractJsonObject(raw) as Record<string, unknown>;
    const text = String(data.text ?? data.body ?? data.post ?? "").trim();
    if (!text) throw new Error("empty");
    return {
      text: text.slice(0, 4096),
      parseMode: normalizeParseMode(data.parseMode),
    };
  } catch {
    const text = raw.trim();
    if (!text) throw new Error("Модель вернула пустой текст");
    return { text: text.slice(0, 4096), parseMode: "HTML" };
  }
}

export async function composeTelegramPost(input: {
  model: string;
  promptTemplate?: string;
  topic: string;
  siteName: string;
  siteUrl: string;
}): Promise<ComposedTelegramPost> {
  const topic = input.topic.trim();
  if (!topic) throw new Error("Укажите тему или описание обновления");
  if (!input.model.trim()) throw new Error("Не выбрана модель ИИ");

  const template =
    (input.promptTemplate ?? "").trim() || DEFAULT_TELEGRAM_COMPOSE_PROMPT;
  const siteUrl = input.siteUrl.replace(/\/+$/, "") || "https://gapsnap.org";
  const prompt = applyPlaceholders(template, {
    topic: topic.length > 4000 ? `${topic.slice(0, 4000)}\n\n[…обрезано]` : topic,
    siteName: input.siteName.trim() || "GapSnap",
    siteUrl,
  });

  const t0 = Date.now();
  const raw = await chatCompletion({
    model: input.model.trim(),
    messages: [
      {
        role: "system",
        content:
          "Ты возвращаешь только валидный JSON-объект по инструкции пользователя. Без пояснений и markdown-обёртки.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });
  console.info(
    `[gapsnap] telegram compose ok in ${Date.now() - t0}ms model=${input.model} inChars=${prompt.length}`,
  );

  return parseComposedTelegramPost(raw);
}
