import "server-only";

import { codexConfigured } from "@/lib/ai/codex-client";
import { fetchRbcCryptoNews } from "@/lib/news/rbc-crypto";
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

function concurrency(): number {
  const raw = Number(process.env.NEWS_SYNC_CONCURRENCY ?? "");
  if (Number.isFinite(raw) && raw >= 1 && raw <= 5) return Math.floor(raw);
  return 2;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]!);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    run(),
  );
  await Promise.all(runners);
  return results;
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

async function runNewsSyncJob(input: {
  model: string;
  rewritePrompt: string;
}): Promise<NewsSyncResultSummary> {
  const seo = await getSeoSettings();
  const feed = await fetchRbcCryptoNews();
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  await mapPool(feed.items, concurrency(), async (item) => {
    try {
      const existing = await getBlogPostBySourceId(item.id);
      if (existing) {
        skipped += 1;
        return;
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
  });

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
    lastSyncResult: result,
  });

  console.info(
    `[gapsnap] news sync: fetched=${result.fetched} created=${result.created} skipped=${result.skipped} failed=${result.failed}`,
  );
  return result;
}

/** Full awaitable sync (used by daily poller). */
export async function syncCryptoNews(options?: {
  force?: boolean;
}): Promise<NewsSyncResultSummary> {
  if (globalThis.__gapsnapNewsSyncInFlight) {
    return globalThis.__gapsnapNewsSyncInFlight;
  }

  const ready = await assertNewsSyncReady(options);
  const run = runNewsSyncJob(ready).finally(() => {
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
}): Promise<{ started: true; alreadyRunning: boolean }> {
  if (globalThis.__gapsnapNewsSyncInFlight) {
    return { started: true, alreadyRunning: true };
  }

  const ready = await assertNewsSyncReady(options);
  const run = runNewsSyncJob(ready)
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
      await syncCryptoNews();
    })().catch((error) => {
      console.error("[gapsnap] news sync failed", error);
    });
  };
  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, ms);
  console.info(
    `[gapsnap] news poller started (every ${Math.round(ms / 3_600_000)}h)`,
  );
}
