import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import { telegramPosts } from "@/db/schema";
import { composeTelegramPost } from "@/lib/telegram/compose-post";
import { composeTelegramPostImage } from "@/lib/telegram/compose-image";
import { DEFAULT_TELEGRAM_COMPOSE_PROMPT } from "@/lib/telegram/default-prompt";

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapTgComposeRuns: Map<string, Promise<void>> | undefined;
}

function runs(): Map<string, Promise<void>> {
  if (!globalThis.__gapsnapTgComposeRuns) {
    globalThis.__gapsnapTgComposeRuns = new Map();
  }
  return globalThis.__gapsnapTgComposeRuns;
}

export function isTelegramComposeRunning(postId: string): boolean {
  return runs().has(postId);
}

async function patchPost(
  id: string,
  patch: Partial<typeof telegramPosts.$inferInsert>,
): Promise<void> {
  await runMigrations();
  const db = getDb();
  await db
    .update(telegramPosts)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(telegramPosts.id, id));
}

async function runComposeDraftJob(postId: string): Promise<void> {
  await runMigrations();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, postId))
    .limit(1);
  if (!row) return;
  if (row.status !== "generating") return;

  const topic = (row.topic || "").trim();
  const withImage = Boolean(row.withImage);

  try {
    await patchPost(postId, {
      progress: "Пишу текст поста…",
      error: null,
    });

    const { getNewsSettings, getSeoSettings } = await import("@/lib/store");
    const { getTelegramSettings } = await import("@/lib/telegram/service");
    const [settings, news, seo] = await Promise.all([
      getTelegramSettings(),
      getNewsSettings().catch(() => null),
      getSeoSettings(),
    ]);

    const model =
      settings.composeModel.trim() || news?.model?.trim() || "";
    if (!model) {
      throw new Error("Выберите модель ИИ в настройках Telegram или Новостей");
    }

    const prompt =
      settings.composePrompt.trim() || DEFAULT_TELEGRAM_COMPOSE_PROMPT;
    const siteName = seo.siteName || "GapSnap";
    const siteUrl =
      seo.siteUrl || process.env.SITE_URL || "https://gapsnap.org";

    const composed = await composeTelegramPost({
      model,
      promptTemplate: prompt,
      topic,
      siteName,
      siteUrl,
    });

    await patchPost(postId, {
      text: composed.text,
      parseMode: composed.parseMode,
      progress: withImage
        ? "Текст готов — рисую обложку…"
        : "Текст готов",
    });

    let photoUrl = row.photoUrl || "";
    if (withImage) {
      const image = await composeTelegramPostImage({
        postText: composed.text,
        topic,
        siteName,
      });
      photoUrl = image.photoUrl;
      await patchPost(postId, {
        photoUrl,
        progress: "Картинка готова",
      });
    }

    await patchPost(postId, {
      status: "draft",
      progress: withImage
        ? "Черновик готов — откройте и опубликуйте"
        : "Черновик готов — откройте и опубликуйте",
      photoUrl,
      error: null,
    });
    console.info(`[gapsnap] telegram compose draft ready id=${postId}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ошибка генерации";
    console.warn(`[gapsnap] telegram compose draft failed id=${postId}:`, message);
    await patchPost(postId, {
      status: "failed",
      progress: "Ошибка генерации",
      error: message,
    }).catch(() => undefined);
  }
}

/**
 * Attach (or re-attach) a background runner for a generating post.
 * Safe to call multiple times — only one run per id.
 */
export function ensureTelegramComposeRunner(postId: string): void {
  const id = postId.trim();
  if (!id || runs().has(id)) return;
  const run = runComposeDraftJob(id).finally(() => {
    runs().delete(id);
  });
  runs().set(id, run);
  void run;
}

/** Mark very old generating rows as failed (e.g. after crash without reclaim). */
export async function reclaimStaleTelegramComposeJobs(): Promise<void> {
  await runMigrations();
  const db = getDb();
  const rows = await db
    .select({
      id: telegramPosts.id,
      updatedAt: telegramPosts.updatedAt,
      topic: telegramPosts.topic,
    })
    .from(telegramPosts)
    .where(eq(telegramPosts.status, "generating"));

  const now = Date.now();
  for (const row of rows) {
    if (runs().has(row.id)) continue;
    const updated = Date.parse(row.updatedAt);
    const age = Number.isFinite(updated) ? now - updated : Number.POSITIVE_INFINITY;
    if (age > 20 * 60_000) {
      await patchPost(row.id, {
        status: "failed",
        progress: "Прервано",
        error: "Генерация прервана (таймаут / перезапуск сервера)",
      });
      continue;
    }
    // Recent generating job with no runner — resume after PM2 restart.
    if ((row.topic || "").trim()) {
      ensureTelegramComposeRunner(row.id);
    }
  }
}
