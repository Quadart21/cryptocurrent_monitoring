import "server-only";

import { generateImage } from "@/lib/ai/codex-client";
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

/** Fast local prompt — no extra chat round-trip (avoids proxy timeouts). */
function buildImagePrompt(input: {
  postText: string;
  topic?: string;
  siteName: string;
}): string {
  const plain = stripTelegramMarkup(input.postText).slice(0, 900);
  if (!plain) throw new Error("Нет текста для картинки");
  const topic = (input.topic ?? "").trim().slice(0, 240);
  const site = input.siteName.trim() || "GapSnap";

  const focus = topic
    ? `Topic: ${topic}. Post summary: ${plain}`
    : `Post summary: ${plain}`;

  return [
    `Square cover illustration for the ${site} Telegram channel (crypto exchanger monitoring).`,
    focus,
    "Style: modern flat tech illustration, clean composition, teal/cyan accents,",
    "soft gradient background, subtle charts/coins/arrows only if they fit the topic.",
    "No photorealism, no clutter, no text, letters, numbers, logos, watermarks, brands, or UI screenshots.",
  ].join(" ");
}

export async function composeTelegramPostImage(input: {
  postText: string;
  topic?: string;
  siteName: string;
  /** @deprecated unused — prompt is built locally for speed */
  textModel?: string;
  imageModel?: string;
}): Promise<{ photoUrl: string; imagePrompt: string }> {
  const t0 = Date.now();
  const imagePrompt = buildImagePrompt({
    postText: input.postText,
    topic: input.topic,
    siteName: input.siteName,
  });

  const image = await generateImage({
    model: input.imageModel,
    prompt: imagePrompt,
    size: "1024x1024",
    // low is much faster on gpt-image-2 and fine for TG covers
    quality: "low",
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
