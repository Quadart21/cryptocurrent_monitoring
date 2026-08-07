import "server-only";

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import { telegramContentJobs, telegramPosts, telegramSettings } from "@/db/schema";
import { getSeoSettings } from "@/lib/store";
import { findNewsCandidates, newsCandidateFromBlog } from "@/lib/telegram/content/detect-news";
import { findSpreadCandidates } from "@/lib/telegram/content/detect-spreads";
import { buildNewsDraft, buildSpreadDraft } from "@/lib/telegram/content/templates";
import type {
  NewsPayload,
  SpreadPayload,
  TelegramContentJob,
  TelegramContentJobKind,
  TelegramContentJobStatus,
  TelegramContentRunResult,
} from "@/lib/telegram/content/types";
import { normalizeTelegramButtons } from "@/lib/telegram/buttons";

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapTelegramContentInFlight:
    | Promise<TelegramContentRunResult>
    | null
    | undefined;
}

function newJobId(): string {
  return `tcj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function newPostId(): string {
  return `tg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function mapJob(row: typeof telegramContentJobs.$inferSelect): TelegramContentJob {
  const kind: TelegramContentJobKind =
    row.kind === "news" ? "news" : "spread";
  const statusRaw = (row.status || "queued") as string;
  const status: TelegramContentJobStatus =
    statusRaw === "drafted" ||
    statusRaw === "published" ||
    statusRaw === "skipped" ||
    statusRaw === "failed" ||
    statusRaw === "discarded" ||
    statusRaw === "queued"
      ? statusRaw
      : "queued";
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    kind,
    dedupeKey: row.dedupeKey,
    status,
    title: row.title ?? "",
    payload: (row.payload ?? {}) as Record<string, unknown>,
    postId: row.postId ?? null,
    error: row.error ?? null,
  };
}

async function existingDedupeKeys(keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const db = getDb();
  const rows = await db
    .select({ dedupeKey: telegramContentJobs.dedupeKey })
    .from(telegramContentJobs)
    .where(inArray(telegramContentJobs.dedupeKey, keys));
  return new Set(rows.map((r) => r.dedupeKey));
}

async function insertJob(input: {
  kind: TelegramContentJobKind;
  dedupeKey: string;
  title: string;
  payload: Record<string, unknown>;
}): Promise<"inserted" | "duplicate"> {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.insert(telegramContentJobs).values({
      id: newJobId(),
      createdAt: now,
      updatedAt: now,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      status: "queued",
      title: input.title.slice(0, 200),
      payload: input.payload,
      postId: null,
      error: null,
    });
    return "inserted";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return "duplicate";
    throw err;
  }
}

async function getContentFlags(): Promise<{
  enabled: boolean;
  spreadEnabled: boolean;
  newsEnabled: boolean;
  minSpreadPct: number;
  minOffers: number;
  maxSpreadPerRun: number;
  cooldownHours: number;
  autoPublish: boolean;
  maxPostsPerDay: number;
  minIntervalMinutes: number;
  quietStartHour: number;
  quietEndHour: number;
  intervalMinutes: number;
  maxNewsPerRun: number;
  newsLookbackHours: number;
  includeCash: boolean;
  pairAllowlist: string;
  pairBlocklist: string;
  footer: string;
  spreadButtonText: string;
  newsButtonText: string;
  utmCampaign: string;
  withNewsImage: boolean;
  channelId: string;
  disablePreview: boolean;
  silent: boolean;
  lastPostAt: string | null;
}> {
  await runMigrations();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramSettings)
    .where(eq(telegramSettings.id, 1))
    .limit(1);
  return {
    enabled: Boolean(row?.contentEnabled),
    spreadEnabled: row?.contentSpreadEnabled !== false,
    newsEnabled: row?.contentNewsEnabled !== false,
    minSpreadPct: Number(row?.contentMinSpreadPct) || 1.5,
    minOffers: Number(row?.contentMinOffers) || 3,
    maxSpreadPerRun: Number(row?.contentMaxSpreadPerRun) || 3,
    cooldownHours: Number(row?.contentSpreadCooldownHours) || 6,
    autoPublish: row?.contentAutoPublish !== false,
    maxPostsPerDay: Number(row?.contentMaxPostsPerDay) || 12,
    minIntervalMinutes:
      typeof row?.contentMinIntervalMinutes === "number"
        ? Math.max(0, Math.floor(row.contentMinIntervalMinutes))
        : 20,
    quietStartHour:
      typeof row?.contentQuietStartHour === "number"
        ? Math.min(23, Math.max(0, Math.floor(row.contentQuietStartHour)))
        : 1,
    quietEndHour:
      typeof row?.contentQuietEndHour === "number"
        ? Math.min(23, Math.max(0, Math.floor(row.contentQuietEndHour)))
        : 8,
    intervalMinutes:
      typeof row?.contentIntervalMinutes === "number" &&
      row.contentIntervalMinutes >= 5
        ? Math.min(180, Math.floor(row.contentIntervalMinutes))
        : 15,
    maxNewsPerRun:
      typeof row?.contentMaxNewsPerRun === "number" &&
      row.contentMaxNewsPerRun >= 1
        ? Math.min(20, Math.floor(row.contentMaxNewsPerRun))
        : 5,
    newsLookbackHours:
      typeof row?.contentNewsLookbackHours === "number" &&
      row.contentNewsLookbackHours >= 1
        ? Math.min(336, Math.floor(row.contentNewsLookbackHours))
        : 48,
    includeCash: Boolean(row?.contentIncludeCash),
    pairAllowlist: row?.contentPairAllowlist ?? "",
    pairBlocklist: row?.contentPairBlocklist ?? "",
    footer: row?.contentFooter ?? "",
    spreadButtonText:
      (row?.contentSpreadButtonText ?? "").trim() || "Смотреть курсы",
    newsButtonText:
      (row?.contentNewsButtonText ?? "").trim() || "Читать статью",
    utmCampaign: (row?.contentUtmCampaign ?? "").trim() || "content",
    withNewsImage: row?.contentWithNewsImage !== false,
    channelId: row?.channelId ?? "",
    disablePreview:
      row?.contentDisablePreview !== undefined
        ? Boolean(row.contentDisablePreview)
        : true,
    silent: Boolean(row?.contentPostSilent),
    lastPostAt: row?.lastPostAt ?? null,
  };
}

/** Current hour in Europe/Moscow (0–23). */
function moscowHourNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour % 24 : 0;
}

function moscowDayPrefix(): string {
  // YYYY-MM-DD in Moscow for counting today's publishes
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function inQuietHours(startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  const h = moscowHourNow();
  if (startHour < endHour) return h >= startHour && h < endHour;
  // wraps midnight, e.g. 23→8
  return h >= startHour || h < endHour;
}

async function countPublishedToday(): Promise<number> {
  const db = getDb();
  const day = moscowDayPrefix();
  const rows = await db
    .select({ id: telegramContentJobs.id, updatedAt: telegramContentJobs.updatedAt })
    .from(telegramContentJobs)
    .where(eq(telegramContentJobs.status, "published"));
  // Compare via Moscow calendar day of updatedAt
  let n = 0;
  for (const r of rows) {
    const d = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(r.updatedAt));
    if (d === day) n += 1;
  }
  return n;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PublishGate =
  | { ok: true }
  | { ok: false; reason: string };

function checkPublishGate(
  flags: Awaited<ReturnType<typeof getContentFlags>>,
  publishedToday: number,
  lastPostAt: string | null,
): PublishGate {
  if (!flags.channelId.trim()) {
    return { ok: false, reason: "Канал не задан" };
  }
  if (inQuietHours(flags.quietStartHour, flags.quietEndHour)) {
    return {
      ok: false,
      reason: `Тихие часы ${flags.quietStartHour}:00–${flags.quietEndHour}:00 МСК`,
    };
  }
  if (publishedToday >= flags.maxPostsPerDay) {
    return {
      ok: false,
      reason: `Дневной лимит ${flags.maxPostsPerDay}`,
    };
  }
  if (flags.minIntervalMinutes > 0 && lastPostAt) {
    const elapsed = Date.now() - Date.parse(lastPostAt);
    const need = flags.minIntervalMinutes * 60_000;
    if (Number.isFinite(elapsed) && elapsed < need) {
      const waitMin = Math.ceil((need - elapsed) / 60_000);
      return {
        ok: false,
        reason: `Интервал: ещё ~${waitMin} мин`,
      };
    }
  }
  return { ok: true };
}

async function publishDraftPost(postId: string): Promise<void> {
  const db = getDb();
  const [post] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, postId))
    .limit(1);
  if (!post) throw new Error("Черновик не найден");
  if (post.status !== "draft" && post.status !== "failed") {
    throw new Error(`Статус поста ${post.status}, публикация пропущена`);
  }
  const { publishTelegramPost } = await import("@/lib/telegram/service");
  await publishTelegramPost({
    draftId: post.id,
    text: post.text,
    photoUrl: post.photoUrl || undefined,
    parseMode: (post.parseMode as "HTML" | "MarkdownV2" | "Markdown") || "HTML",
    disablePreview: Boolean(post.disablePreview),
    silent: Boolean(post.silent),
    buttons: normalizeTelegramButtons(post.buttons ?? []),
    adminLogin: "content-bot",
  });
}

async function writeRunResult(result: TelegramContentRunResult): Promise<void> {
  const db = getDb();
  await db
    .update(telegramSettings)
    .set({
      contentLastRunAt: result.ranAt,
      contentLastRunResult: result.message.slice(0, 500),
      updatedAt: result.ranAt,
    })
    .where(eq(telegramSettings.id, 1));
}

async function draftFromJob(
  job: TelegramContentJob,
  opts: {
    siteName: string;
    siteUrl: string;
    channelId: string;
    disablePreview: boolean;
    silent: boolean;
    footer: string;
    spreadButtonText: string;
    newsButtonText: string;
    utmCampaign: string;
    withNewsImage: boolean;
  },
): Promise<{ postId: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  const postId = newPostId();

  let text = "";
  let topic = "";
  let photoUrl = "";
  let buttons: Array<Array<{ text: string; url: string }>> = [];

  const templateOpts = {
    siteName: opts.siteName,
    siteUrl: opts.siteUrl,
    footer: opts.footer,
    spreadButtonText: opts.spreadButtonText,
    newsButtonText: opts.newsButtonText,
    utmCampaign: opts.utmCampaign,
    withNewsImage: opts.withNewsImage,
  };

  if (job.kind === "spread") {
    const payload = job.payload as unknown as SpreadPayload;
    const built = buildSpreadDraft({
      payload,
      ...templateOpts,
    });
    text = built.text;
    topic = built.topic;
    buttons = built.buttons;
  } else {
    const payload = job.payload as unknown as NewsPayload;
    const built = buildNewsDraft({
      payload,
      ...templateOpts,
    });
    text = built.text;
    topic = built.topic;
    photoUrl = built.photoUrl;
    buttons = built.buttons;
  }

  await db.insert(telegramPosts).values({
    id: postId,
    createdAt: now,
    updatedAt: now,
    chatId: opts.channelId || "",
    messageId: null,
    text,
    parseMode: "HTML",
    disablePreview: opts.disablePreview,
    silent: opts.silent,
    photoUrl,
    buttons: normalizeTelegramButtons(buttons),
    topic,
    progress: "Черновик из контент-машины",
    withImage: Boolean(photoUrl),
    status: "draft",
    error: null,
    adminLogin: "content-bot",
  });

  await db
    .update(telegramContentJobs)
    .set({
      status: "drafted",
      postId,
      updatedAt: now,
      error: null,
    })
    .where(eq(telegramContentJobs.id, job.id));

  return { postId };
}

async function enqueueDetectors(flags: Awaited<ReturnType<typeof getContentFlags>>): Promise<{
  spreadEnqueued: number;
  newsEnqueued: number;
}> {
  let spreadEnqueued = 0;
  let newsEnqueued = 0;

  if (flags.spreadEnabled) {
    const candidates = await findSpreadCandidates({
      minSpreadPct: flags.minSpreadPct,
      minOffers: flags.minOffers,
      maxResults: Math.max(flags.maxSpreadPerRun * 3, 12),
      cooldownHours: flags.cooldownHours,
      includeCash: flags.includeCash,
      allowlist: flags.pairAllowlist,
      blocklist: flags.pairBlocklist,
    });
    const known = await existingDedupeKeys(candidates.map((c) => c.dedupeKey));
    for (const c of candidates) {
      if (spreadEnqueued >= flags.maxSpreadPerRun) break;
      if (known.has(c.dedupeKey)) continue;
      const payload: SpreadPayload = {
        from: c.from,
        to: c.to,
        bestRate: c.bestRate,
        worstRate: c.worstRate,
        offerCount: c.offerCount,
        spreadPct: c.spreadPct,
        pairPath: c.pairPath,
      };
      const res = await insertJob({
        kind: "spread",
        dedupeKey: c.dedupeKey,
        title: c.title,
        payload: payload as unknown as Record<string, unknown>,
      });
      if (res === "inserted") {
        spreadEnqueued += 1;
        known.add(c.dedupeKey);
      }
    }
  }

  if (flags.newsEnabled) {
    const candidates = await findNewsCandidates({
      limit: flags.maxNewsPerRun,
      lookbackMs: flags.newsLookbackHours * 3_600_000,
    });
    const known = await existingDedupeKeys(candidates.map((c) => c.dedupeKey));
    for (const c of candidates) {
      if (known.has(c.dedupeKey)) continue;
      const payload: NewsPayload = {
        blogId: c.blogId,
        slug: c.slug,
        title: c.title,
        excerpt: c.excerpt,
        coverImageUrl: c.coverImageUrl,
        blogPath: c.blogPath,
      };
      const res = await insertJob({
        kind: "news",
        dedupeKey: c.dedupeKey,
        title: c.title,
        payload: payload as unknown as Record<string, unknown>,
      });
      if (res === "inserted") {
        newsEnqueued += 1;
        known.add(c.dedupeKey);
      }
    }
  }

  return { spreadEnqueued, newsEnqueued };
}

async function processQueued(flags: Awaited<ReturnType<typeof getContentFlags>>): Promise<{
  drafted: number;
  published: number;
  failed: number;
  skipped: number;
}> {
  const seo = await getSeoSettings();
  const siteName = seo.siteName?.trim() || "GapSnap";
  const siteUrl = (
    seo.siteUrl?.trim() ||
    process.env.SITE_URL ||
    "https://gapsnap.org"
  ).replace(/\/+$/, "");

  const db = getDb();
  const rows = await db
    .select()
    .from(telegramContentJobs)
    .where(eq(telegramContentJobs.status, "queued"))
    .orderBy(telegramContentJobs.createdAt)
    .limit(20);

  let drafted = 0;
  let published = 0;
  let failed = 0;
  let skipped = 0;
  let publishedToday = await countPublishedToday();
  let lastPostAt = flags.lastPostAt;

  for (const row of rows) {
    const job = mapJob(row);
    try {
      const { postId } = await draftFromJob(job, {
        siteName,
        siteUrl,
        channelId: flags.channelId,
        disablePreview: flags.disablePreview,
        silent: flags.silent,
        footer: flags.footer,
        spreadButtonText: flags.spreadButtonText,
        newsButtonText: flags.newsButtonText,
        utmCampaign: flags.utmCampaign,
        withNewsImage: flags.withNewsImage,
      });
      drafted += 1;

      if (!flags.autoPublish) continue;

      const gate = checkPublishGate(flags, publishedToday, lastPostAt);
      if (!gate.ok) {
        skipped += 1;
        console.info(
          `[gapsnap] telegram content auto-publish deferred ${job.id}: ${gate.reason}`,
        );
        continue;
      }

      try {
        await publishDraftPost(postId);
        const now = new Date().toISOString();
        await db
          .update(telegramContentJobs)
          .set({
            status: "published",
            updatedAt: now,
            error: null,
          })
          .where(eq(telegramContentJobs.id, job.id));
        published += 1;
        publishedToday += 1;
        lastPostAt = now;
        // small pause between channel posts
        await sleep(1500);
      } catch (pubErr) {
        failed += 1;
        const message =
          pubErr instanceof Error ? pubErr.message : String(pubErr);
        const now = new Date().toISOString();
        await db
          .update(telegramContentJobs)
          .set({
            status: "drafted",
            error: `Автопост: ${message}`.slice(0, 500),
            updatedAt: now,
          })
          .where(eq(telegramContentJobs.id, job.id));
        console.error(
          `[gapsnap] telegram content auto-publish failed ${job.id}`,
          pubErr,
        );
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      const now = new Date().toISOString();
      await db
        .update(telegramContentJobs)
        .set({
          status: "failed",
          error: message.slice(0, 500),
          updatedAt: now,
        })
        .where(eq(telegramContentJobs.id, job.id));
      console.error(`[gapsnap] telegram content job failed ${job.id}`, err);
    }
  }

  return { drafted, published, failed, skipped };
}

/** Publish leftover drafts (status=drafted) when auto-publish is on. */
async function publishPendingDrafts(
  flags: Awaited<ReturnType<typeof getContentFlags>>,
): Promise<{ published: number; failed: number; skipped: number }> {
  if (!flags.autoPublish) {
    return { published: 0, failed: 0, skipped: 0 };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(telegramContentJobs)
    .where(eq(telegramContentJobs.status, "drafted"))
    .orderBy(telegramContentJobs.createdAt)
    .limit(15);

  let published = 0;
  let failed = 0;
  let skipped = 0;
  let publishedToday = await countPublishedToday();
  let lastPostAt = flags.lastPostAt;

  // refresh lastPostAt from settings in case processQueued already posted
  const [settingsRow] = await db
    .select({ lastPostAt: telegramSettings.lastPostAt })
    .from(telegramSettings)
    .where(eq(telegramSettings.id, 1))
    .limit(1);
  if (settingsRow?.lastPostAt) lastPostAt = settingsRow.lastPostAt;

  for (const row of rows) {
    const job = mapJob(row);
    if (!job.postId) {
      skipped += 1;
      continue;
    }

    const gate = checkPublishGate(flags, publishedToday, lastPostAt);
    if (!gate.ok) {
      skipped += 1;
      console.info(
        `[gapsnap] telegram content pending publish deferred ${job.id}: ${gate.reason}`,
      );
      // if quiet hours / daily limit — stop trying more this cycle
      if (
        gate.reason.startsWith("Тихие") ||
        gate.reason.startsWith("Дневной")
      ) {
        break;
      }
      continue;
    }

    try {
      await publishDraftPost(job.postId);
      const now = new Date().toISOString();
      await db
        .update(telegramContentJobs)
        .set({
          status: "published",
          updatedAt: now,
          error: null,
        })
        .where(eq(telegramContentJobs.id, job.id));
      published += 1;
      publishedToday += 1;
      lastPostAt = now;
      await sleep(1500);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      const now = new Date().toISOString();
      await db
        .update(telegramContentJobs)
        .set({
          error: `Автопост: ${message}`.slice(0, 500),
          updatedAt: now,
        })
        .where(eq(telegramContentJobs.id, job.id));
      console.error(
        `[gapsnap] telegram content pending publish failed ${job.id}`,
        err,
      );
    }
  }

  return { published, failed, skipped };
}

/** Full content-machine cycle: detect → enqueue → draft → auto-publish. */
export async function runTelegramContentCycle(options?: {
  force?: boolean;
}): Promise<TelegramContentRunResult> {
  if (globalThis.__gapsnapTelegramContentInFlight) {
    return globalThis.__gapsnapTelegramContentInFlight;
  }

  const run = (async (): Promise<TelegramContentRunResult> => {
    await runMigrations();
    const flags = await getContentFlags();
    const ranAt = new Date().toISOString();

    if (!flags.enabled && !options?.force) {
      const result: TelegramContentRunResult = {
        ok: true,
        enabled: false,
        spreadEnqueued: 0,
        newsEnqueued: 0,
        drafted: 0,
        published: 0,
        failed: 0,
        skipped: 0,
        message: "Контент-машина выключена",
        ranAt,
      };
      await writeRunResult(result);
      return result;
    }

    const { spreadEnqueued, newsEnqueued } = await enqueueDetectors(flags);
    const queued = await processQueued(flags);
    const pending = await publishPendingDrafts({
      ...flags,
      lastPostAt: (await getContentFlags()).lastPostAt,
    });
    const published = queued.published + pending.published;
    const failed = queued.failed + pending.failed;
    const skipped = queued.skipped + pending.skipped;
    const message = [
      `spread +${spreadEnqueued}`,
      `news +${newsEnqueued}`,
      `drafts ${queued.drafted}`,
      `sent ${published}`,
      skipped ? `skip ${skipped}` : null,
      failed ? `fail ${failed}` : null,
      flags.autoPublish ? "auto" : "manual",
    ]
      .filter(Boolean)
      .join(", ");
    const result: TelegramContentRunResult = {
      ok: failed === 0,
      enabled: true,
      spreadEnqueued,
      newsEnqueued,
      drafted: queued.drafted,
      published,
      failed,
      skipped,
      message,
      ranAt,
    };
    await writeRunResult(result);
    console.info(`[gapsnap] telegram content: ${message}`);
    return result;
  })().finally(() => {
    globalThis.__gapsnapTelegramContentInFlight = null;
  });

  globalThis.__gapsnapTelegramContentInFlight = run;
  return run;
}

/** Enqueue a news mirror job right after blog publish (no-op if machine off / news off). */
export async function enqueueTelegramNewsFromBlog(post: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string;
}): Promise<{ enqueued: boolean; reason?: string }> {
  try {
    await runMigrations();
    const flags = await getContentFlags();
    if (!flags.enabled || !flags.newsEnabled) {
      return { enqueued: false, reason: "disabled" };
    }
    const candidate = newsCandidateFromBlog(post);
    if (!candidate) return { enqueued: false, reason: "invalid" };
    const known = await existingDedupeKeys([candidate.dedupeKey]);
    if (known.has(candidate.dedupeKey)) {
      return { enqueued: false, reason: "duplicate" };
    }
    const payload: NewsPayload = {
      blogId: candidate.blogId,
      slug: candidate.slug,
      title: candidate.title,
      excerpt: candidate.excerpt,
      coverImageUrl: candidate.coverImageUrl,
      blogPath: candidate.blogPath,
    };
    const res = await insertJob({
      kind: "news",
      dedupeKey: candidate.dedupeKey,
      title: candidate.title,
      payload: payload as unknown as Record<string, unknown>,
    });
    if (res === "duplicate") return { enqueued: false, reason: "duplicate" };

    // Draft immediately so admin sees it in the journal without waiting for poller.
    await processQueued(flags);
    return { enqueued: true };
  } catch (err) {
    console.warn("[gapsnap] enqueue telegram news failed", err);
    return { enqueued: false, reason: "error" };
  }
}

export async function listTelegramContentJobs(
  limit = 40,
): Promise<TelegramContentJob[]> {
  await runMigrations();
  const db = getDb();
  const rows = await db
    .select()
    .from(telegramContentJobs)
    .orderBy(desc(telegramContentJobs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  return rows.map(mapJob);
}

export async function discardTelegramContentJob(
  id: string,
): Promise<TelegramContentJob> {
  await runMigrations();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramContentJobs)
    .where(eq(telegramContentJobs.id, id))
    .limit(1);
  if (!row) throw new Error("Задача не найдена");
  if (row.status === "discarded") return mapJob(row);

  const now = new Date().toISOString();
  if (row.postId) {
    const [post] = await db
      .select()
      .from(telegramPosts)
      .where(eq(telegramPosts.id, row.postId))
      .limit(1);
    if (post && (post.status === "draft" || post.status === "failed")) {
      await db
        .update(telegramPosts)
        .set({
          status: "deleted",
          updatedAt: now,
          progress: "Удалён из очереди контента",
          error: null,
        })
        .where(eq(telegramPosts.id, post.id));
    }
  }

  await db
    .update(telegramContentJobs)
    .set({ status: "discarded", updatedAt: now, error: null })
    .where(eq(telegramContentJobs.id, id));

  const [updated] = await db
    .select()
    .from(telegramContentJobs)
    .where(eq(telegramContentJobs.id, id))
    .limit(1);
  return mapJob(updated!);
}
