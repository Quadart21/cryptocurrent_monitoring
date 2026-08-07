import "server-only";

import { codexConfigured } from "@/lib/ai/codex-client";
import { fetchRbcCryptoNews, type RbcCryptoNewsItem } from "@/lib/news/rbc-crypto";
import {
  isExternalHttpUrl,
  isLocalNewsCoverUrl,
  mirrorNewsCover,
} from "@/lib/news/mirror-cover";
import { rewriteNewsArticle } from "@/lib/news/rewrite-article";
import {
  createBlogPost,
  getBlogPostBySourceId,
  getNewsSettings,
  getSeoSettings,
  listBlogPosts,
  setNewsSyncLiveStatus,
  updateBlogPost,
  updateNewsSettings,
  type NewsSyncResultSummary,
} from "@/lib/store";

const SOURCE_PROVIDER = "rbc-crypto";
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const START_DELAY_MS = 90_000;
const STALE_SYNC_MS = 15 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapNewsPollerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapNewsSyncInFlight: Promise<NewsSyncResultSummary> | null | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapNewsSyncProgress: string | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapNewsSyncStartedAt: number | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapNewsSyncProgressWriteAt: number | undefined;
}

function setProgress(msg: string) {
  globalThis.__gapsnapNewsSyncProgress = msg;
  console.info(`[gapsnap] news: ${msg}`);
  const now = Date.now();
  const last = globalThis.__gapsnapNewsSyncProgressWriteAt ?? 0;
  if (now - last < 700) return;
  globalThis.__gapsnapNewsSyncProgressWriteAt = now;
  void setNewsSyncLiveStatus({ progress: msg }).catch(() => undefined);
}

async function markSyncStarted() {
  const iso = new Date().toISOString();
  globalThis.__gapsnapNewsSyncStartedAt = Date.now();
  globalThis.__gapsnapNewsSyncProgressWriteAt = 0;
  await setNewsSyncLiveStatus({
    progress: "Старт…",
    startedAt: iso,
  }).catch(() => undefined);
}

async function markSyncFinished() {
  globalThis.__gapsnapNewsSyncProgress = "";
  globalThis.__gapsnapNewsSyncStartedAt = undefined;
  await setNewsSyncLiveStatus({ clear: true }).catch(() => undefined);
}

function intervalMs(): number {
  const raw = Number(process.env.NEWS_SYNC_INTERVAL_MS ?? "");
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return DEFAULT_INTERVAL_MS;
}

/** How many new articles to create per sync run (default: whole RSS page, up to 50). */
function batchSize(override?: number): number {
  if (typeof override === "number" && override >= 1) {
    return Math.min(50, Math.floor(override));
  }
  const raw = Number(process.env.NEWS_SYNC_BATCH_SIZE ?? "");
  if (Number.isFinite(raw) && raw >= 1) return Math.min(50, Math.floor(raw));
  return 50;
}

function pauseMs(): number {
  const pause = Number(process.env.NEWS_SYNC_PAUSE_MS ?? "");
  if (Number.isFinite(pause) && pause >= 0) return pause;
  // Small gap between articles; proxy rotates on 429 anyway
  return 1_500;
}

export function isNewsSyncInFlight(): boolean {
  return Boolean(globalThis.__gapsnapNewsSyncInFlight);
}

export function getNewsSyncProgress(): {
  inFlight: boolean;
  progress: string;
  startedAt: number | null;
  elapsedMs: number | null;
} {
  const startedAt = globalThis.__gapsnapNewsSyncStartedAt ?? null;
  return {
    inFlight: isNewsSyncInFlight(),
    progress: globalThis.__gapsnapNewsSyncProgress ?? "",
    startedAt,
    elapsedMs: startedAt ? Date.now() - startedAt : null,
  };
}

/** Prefer memory; fall back to DB so admin polling works if workers differ. */
export async function getNewsSyncStatus(): Promise<{
  inFlight: boolean;
  progress: string;
  elapsedMs: number | null;
  lastSyncAt: string | null;
  lastSyncResult: NewsSyncResultSummary | null;
}> {
  const settings = await getNewsSettings();
  const mem = getNewsSyncProgress();
  const dbStartedMs = settings.syncStartedAt
    ? Date.parse(settings.syncStartedAt)
    : NaN;
  const dbFresh =
    Number.isFinite(dbStartedMs) && Date.now() - dbStartedMs < STALE_SYNC_MS;
  const inFlight = mem.inFlight || (dbFresh && Boolean(settings.syncStartedAt));
  const startedAt = mem.startedAt ?? (dbFresh ? dbStartedMs : null);
  const progress =
    mem.progress ||
    settings.syncProgress ||
    (inFlight ? "Синхронизация в фоне…" : "");
  return {
    inFlight,
    progress,
    elapsedMs: startedAt ? Date.now() - startedAt : null,
    lastSyncAt: settings.lastSyncAt,
    lastSyncResult: settings.lastSyncResult,
  };
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

/** Re-host remote covers already in DB so visitors never hit rbc.ru. */
async function remirrorExternalCovers(): Promise<number> {
  const posts = await listBlogPosts({ status: "all" });
  let mirrored = 0;
  for (const post of posts) {
    const url = post.coverImageUrl.trim();
    if (!url || isLocalNewsCoverUrl(url) || !isExternalHttpUrl(url)) continue;
    setProgress(`Зеркалирую обложку: ${post.title.slice(0, 50)}…`);
    const local = await mirrorNewsCover({
      sourceUrl: url,
      key: post.sourceId || post.id,
    });
    await updateBlogPost(post.id, {
      coverImageUrl: local ?? "",
    });
    if (local) mirrored += 1;
  }
  return mirrored;
}

async function resolveCoverUrl(
  item: RbcCryptoNewsItem,
): Promise<string> {
  if (!item.imageUrl?.trim()) return "";
  const local = await mirrorNewsCover({
    sourceUrl: item.imageUrl,
    key: item.id,
  });
  return local ?? "";
}

async function runNewsSyncJob(input: {
  model: string;
  rewritePrompt: string;
  maxCreate: number;
}): Promise<NewsSyncResultSummary> {
  const t0 = Date.now();
  setProgress("Зеркалирование старых обложек…");
  const remirrored = await remirrorExternalCovers();
  if (remirrored > 0) {
    console.info(`[gapsnap] news covers remirrored: ${remirrored}`);
  }

  setProgress("Загрузка RSS РБК…");
  const seo = await getSeoSettings();
  const feed = await fetchRbcCryptoNews();
  setProgress(`RSS: ${feed.items.length} шт., ищем новые…`);
  const { toCreate, skipped: alreadyKnown } = await pickNewItems(
    feed.items,
    input.maxCreate,
  );

  let created = 0;
  let failed = 0;
  let skipped = alreadyKnown;
  const errors: string[] = [];

  if (!toCreate.length) {
    setProgress(
      remirrored > 0
        ? `Новых статей нет, обложек перезалито: ${remirrored}`
        : "Новых статей нет",
    );
  }

  // One-by-one, never parallel
  for (let i = 0; i < toCreate.length; i += 1) {
    const item = toCreate[i]!;
    try {
      const existing = await getBlogPostBySourceId(item.id);
      if (existing) {
        skipped += 1;
        continue;
      }
      setProgress(
        `Рерайт через codex.sale (${i + 1}/${toCreate.length}): ${item.title.slice(0, 60)}…`,
      );
      const rewritten = await rewriteNewsArticle({
        model: input.model,
        promptTemplate: input.rewritePrompt,
        item,
        siteName: seo.siteName || "GapSnap",
        siteUrl: seo.siteUrl || process.env.SITE_URL || "https://gapsnap.org",
      });
      setProgress(`Скачиваю обложку: ${item.title.slice(0, 50)}…`);
      const coverImageUrl = await resolveCoverUrl(item);
      setProgress(`Сохранение в БД: ${rewritten.title.slice(0, 60)}…`);
      const createdPost = await createBlogPost({
        title: rewritten.title,
        slug: rewritten.slug || undefined,
        excerpt: rewritten.excerpt,
        body: rewritten.bodyMarkdown,
        coverImageUrl,
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
      try {
        const { enqueueTelegramNewsFromBlog } = await import(
          "@/lib/telegram/content/engine"
        );
        await enqueueTelegramNewsFromBlog({
          id: createdPost.id,
          slug: createdPost.slug,
          title: createdPost.title,
          excerpt: createdPost.excerpt,
          coverImageUrl: createdPost.coverImageUrl,
        });
      } catch (tgErr) {
        console.warn("[gapsnap] telegram news enqueue skipped", tgErr);
      }
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

  setProgress(
    `Готово за ${Math.round((Date.now() - t0) / 1000)}с: +${created}, skip ${skipped}, fail ${failed}`,
  );
  console.info(
    `[gapsnap] news sync: fetched=${result.fetched} created=${result.created} skipped=${result.skipped} failed=${result.failed} batch=${input.maxCreate} ms=${Date.now() - t0}`,
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

/** Full awaitable sync (used by hourly poller). */
export async function syncCryptoNews(options?: {
  force?: boolean;
  maxCreate?: number;
}): Promise<NewsSyncResultSummary> {
  if (globalThis.__gapsnapNewsSyncInFlight) {
    return globalThis.__gapsnapNewsSyncInFlight;
  }

  const ready = await assertNewsSyncReady(options);
  await markSyncStarted();
  setProgress("Старт…");
  const run = runNewsSyncJob({
    ...ready,
    maxCreate: batchSize(options?.maxCreate),
  }).finally(() => {
    globalThis.__gapsnapNewsSyncInFlight = null;
    void markSyncFinished();
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
  await markSyncStarted();
  setProgress("Старт…");
  const run = runNewsSyncJob({
    ...ready,
    maxCreate: batchSize(options?.maxCreate),
  })
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[gapsnap] news sync failed", err);
      setProgress(`Ошибка: ${message}`);
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
      void markSyncFinished();
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
      // Auto: process up to batchSize() new items per hourly tick
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
