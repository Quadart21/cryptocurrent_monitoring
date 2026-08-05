import "server-only";

import { chatCompletion, generateImage } from "@/lib/ai/codex-client";
import { DEFAULT_TELEGRAM_IMAGE_PROMPT } from "@/lib/telegram/default-prompt";
import { saveGeneratedTgImage } from "@/lib/telegram/tg-image";

function stripTelegramMarkup(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function applyPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

async function buildImagePrompt(input: {
  postText: string;
  topic?: string;
  siteName: string;
  textModel: string;
}): Promise<string> {
  const plain = stripTelegramMarkup(input.postText).slice(0, 2500);
  if (!plain) throw new Error("Нет текста для картинки");

  const userPrompt = applyPlaceholders(DEFAULT_TELEGRAM_IMAGE_PROMPT, {
    postText: plain,
    topic: (input.topic ?? "").trim().slice(0, 800),
    siteName: input.siteName.trim() || "GapSnap",
  });

  const raw = await chatCompletion({
    model: input.textModel,
    messages: [
      {
        role: "system",
        content:
          "You write a single English image-generation prompt. Return only the prompt text, no quotes or markdown.",
      },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
  });

  const prompt = raw
    .replace(/^```[\s\S]*?```$/g, (m) => m.replace(/```(?:\w+)?/g, "").trim())
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .trim();
  if (!prompt) throw new Error("Модель вернула пустой image-промпт");
  return prompt.slice(0, 3500);
}

export async function composeTelegramPostImage(input: {
  postText: string;
  topic?: string;
  siteName: string;
  textModel: string;
  imageModel?: string;
}): Promise<{ photoUrl: string; imagePrompt: string }> {
  const t0 = Date.now();
  const imagePrompt = await buildImagePrompt({
    postText: input.postText,
    topic: input.topic,
    siteName: input.siteName,
    textModel: input.textModel,
  });

  const image = await generateImage({
    model: input.imageModel,
    prompt: imagePrompt,
    size: "1024x1024",
    quality: "medium",
  });

  const saved = await saveGeneratedTgImage({
    bytes: image.bytes,
    seed: imagePrompt,
  });

  console.info(
    `[gapsnap] telegram image ok in ${Date.now() - t0}ms path=${saved.publicPath}`,
  );

  return { photoUrl: saved.publicPath, imagePrompt };
}
