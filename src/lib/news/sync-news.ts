import "server-only";

import { codexConfigured } from "@/lib/ai/codex-client";
import { fetchRbcCryptoNews, type RbcCryptoNewsItem } from "@/lib/news/rbc-crypto";
import { rewriteNewsArticle } from "@/lib/news/rewrite-article";
import {
  createBlogPost,
  getBlogPostBySourceId,
  getNewsSettings,
  getSeoSettings,
  updateNewsSettings,
  type NewsSyncResultSummary,
} from "@/lib/store";

const SOURCE_PROVIDER = "rbc-crypto";
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const START_DELAY_MS = 90_000;

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapNewsPollerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapNewsSyncInFlight: Promise<NewsSyncResultSummary> | null | undefined;
}

function intervalMs(): number {
  const raw = Number(process.env.NEWS_SYNC_INTERVAL_MS ?? "");
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return DEFAULT_INTERVAL_MS;
}

/** How many new articles to create per sync run (default 1). */
function batchSize(override?: number): number {
  if (typeof override === "number" && override >= 1) {
    return Math.min(30, Math.floor(override));
  }
  const raw = Number(process.env.NEWS_SYNC_BATCH_SIZE ?? "");
  if (Number.isFinite(raw) && raw >= 1) return Math.min(30, Math.floor(raw));
  return 1;
}

function pauseMs(): number {
  const pause = Number(process.env.NEWS_SYNC_PAUSE_MS ?? "");
  if (Number.isFinite(pause) && pause >= 0) return pause;
  return 3_000;
}

export function isNewsSyncInFlight(): boolean {
  return Boolean(globalThis.__gapsnapNewsSyncInFlight);
}

async function assertNewsSyncReady(options?: { force?: boolean }): Promise<{
  model: string;
  rewritePrompt: string;
}> {
  const settings = await getNewsSettings();
  if (!options?.force && !settings.enabled) {
    throw new Error("Автосинк новостей выключен");
  }
  if (!codexConfigured()) {
    throw new Error("CODEX_API_KEY не задан");
  }
  if (!settings.model.trim()) {
    throw new Error("В настройках новостей не выбрана модель");
  }
  if (!settings.rewritePrompt.trim()) {
    throw new Error("В настройках новостей пустой промпт");
  }
  return {
    model: settings.model.trim(),
    rewritePrompt: settings.rewritePrompt,
  };
}

async function pickNewItems(
  items: RbcCryptoNewsItem[],
  maxCreate: number,
): Promise<{ toCreate: RbcCryptoNewsItem[]; skipped: number }> {
  const toCreate: RbcCryptoNewsItem[] = [];
  let skipped = 0;
  for (const item of items) {
    const existing = await getBlogPostBySourceId(item.id);
    if (existing) {
      skipped += 1;
      continue;
    }
    toCreate.push(item);
    if (toCreate.length >= maxCreate) break;
  }
  return { toCreate, skipped };
}

async function runNewsSyncJob(input: {
  model: string;
  rewritePrompt: string;
  maxCreate: number;
}): Promise<NewsSyncResultSummary> {
  const seo = await getSeoSettings();
  const feed = await fetchRbcCryptoNews();
  const { toCreate, skipped: alreadyKnown } = await pickNewItems(
    feed.items,
    input.maxCreate,
  );

  let created = 0;
  let failed = 0;
  let skipped = alreadyKnown;
  const errors: string[] = [];

  // One-by-one, never parallel
  for (const item of toCreate) {
    try {
      // Re-check in case another run created it
      const existing = await getBlogPostBySourceId(item.id);
      if (existing) {
        skipped += 1;
        continue;
      }
      const rewritten = await rewriteNewsArticle({
        model: input.model,
        promptTemplate: input.rewritePrompt,
        item,
        siteName: seo.siteName || "GapSnap",
        siteUrl: seo.siteUrl || process.env.SITE_URL || "https://gapsnap.org",
      });
      await createBlogPost({
        title: rewritten.title,
        slug: rewritten.slug || undefined,
        excerpt: rewritten.excerpt,
        body: rewritten.bodyMarkdown,
        coverImageUrl: item.imageUrl ?? "",
        tags: rewritten.tags.length ? rewritten.tags : item.tags,
        status: "published",
        seoTitle: rewritten.seoTitle,
        seoDescription: rewritten.seoDescription,
        authorName: "GapSnap",
        sourceProvider: SOURCE_PROVIDER,
        sourceId: item.id,
        sourceUrl: item.link,
      });
      created += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${item.id}: ${msg}`);
      console.error(`[gapsnap] news rewrite failed ${item.id}`, err);
    }
    const ms = pauseMs();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }

  const remainingNew = Math.max(
    0,
    feed.items.length - alreadyKnown - toCreate.length,
  );

  const result: NewsSyncResultSummary = {
    fetched: feed.items.length,
    created,
    skipped,
    failed,
    errors: errors.slice(0, 20),
    syncedAt: new Date().toISOString(),
  };

  await updateNewsSettings({
    lastSyncAt: result.syncedAt,
    lastSyncResult: {
      ...result,
      errors:
        remainingNew > 0
          ? [
              ...result.errors,
              `Осталось новых в ленте: ~${remainingNew}. Нажмите синк ещё раз.`,
            ]
          : result.errors,
    },
  });

  console.info(
    `[gapsnap] news sync: fetched=${result.fetched} created=${result.created} skipped=${result.skipped} failed=${result.failed} batch=${input.maxCreate}`,
  );
  return {
    ...result,
    errors:
      remainingNew > 0
        ? [
            ...result.errors,
            `Осталось новых в ленте: ~${remainingNew}. Нажмите синк ещё раз.`,
          ]
        : result.errors,
  };
}

/** Full awaitable sync (used by daily poller). */
export async function syncCryptoNews(options?: {
  force?: boolean;
  maxCreate?: number;
}): Promise<NewsSyncResultSummary> {
  if (globalThis.__gapsnapNewsSyncInFlight) {
    return globalThis.__gapsnapNewsSyncInFlight;
  }

  const ready = await assertNewsSyncReady(options);
  const run = runNewsSyncJob({
    ...ready,
    maxCreate: batchSize(options?.maxCreate),
  }).finally(() => {
    globalThis.__gapsnapNewsSyncInFlight = null;
  });
  globalThis.__gapsnapNewsSyncInFlight = run;
  return run;
}

/**
 * Start sync in background and return immediately (avoids proxy HTML timeouts).
 * Validation errors throw before the job is started.
 */
export async function startNewsSync(options?: {
  force?: boolean;
  maxCreate?: number;
}): Promise<{ started: true; alreadyRunning: boolean }> {
  if (globalThis.__gapsnapNewsSyncInFlight) {
    return { started: true, alreadyRunning: true };
  }

  const ready = await assertNewsSyncReady(options);
  const run = runNewsSyncJob({
    ...ready,
    maxCreate: batchSize(options?.maxCreate ?? 1),
  })
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[gapsnap] news sync failed", err);
      const failedResult: NewsSyncResultSummary = {
        fetched: 0,
        created: 0,
        skipped: 0,
        failed: 1,
        errors: [message],
        syncedAt: new Date().toISOString(),
      };
      try {
        await updateNewsSettings({
          lastSyncAt: failedResult.syncedAt,
          lastSyncResult: failedResult,
        });
      } catch {
        /* ignore */
      }
      return failedResult;
    })
    .finally(() => {
      globalThis.__gapsnapNewsSyncInFlight = null;
    });

  globalThis.__gapsnapNewsSyncInFlight = run;
  return { started: true, alreadyRunning: false };
}

export function startNewsPoller(): void {
  if (globalThis.__gapsnapNewsPollerStarted) return;
  globalThis.__gapsnapNewsPollerStarted = true;
  const ms = intervalMs();
  const tick = () => {
    void (async () => {
      const settings = await getNewsSettings();
      if (!settings.enabled) return;
      // Auto: still one-by-one per tick (batch size from env, default 1)
      await syncCryptoNews();
    })().catch((error) => {
      console.error("[gapsnap] news sync failed", error);
    });
  };
  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, ms);
  console.info(
    `[gapsnap] news poller started (every ${Math.round(ms / 3_600_000)}h, batch=${batchSize()})`,
  );
}
