import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import {
  exchangers,
  feedScoutSettings,
  feedScoutSubmissions,
  feedScoutWorkers,
} from "@/db/schema";
import {
  scoutTgDeleteWebhook,
  scoutTgGetMe,
  scoutTgGetWebhookInfo,
  scoutTgSendMessage,
  scoutTgSetWebhook,
} from "@/lib/feed-scout/client";
import { enrichExchangerFromFeedUrl } from "@/lib/feed-scout/enrich-site";
import {
  extractUrlsFromText,
  normalizeFeedUrl,
} from "@/lib/feed-scout/normalize";
import type {
  FeedScoutPayoutStatus,
  FeedScoutSettings,
  FeedScoutSettingsPublic,
  FeedScoutSubmission,
  FeedScoutUrlResult,
  FeedScoutWorker,
  FeedScoutWorkerStatus,
} from "@/lib/feed-scout/types";
import { maskSecret, xrocketGetAppInfo, xrocketTransfer } from "@/lib/feed-scout/xrocket";
import { saveExchangerLogo } from "@/lib/logo";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";
import { getSeoSettings, createExchangerManual, replaceExchangerRates } from "@/lib/store";
import { validateFeedUrl } from "@/lib/sync-feeds";
import { maskBotToken } from "@/lib/telegram/client";

const MAX_URLS_PER_MESSAGE = 20;

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapSettings(
  row: typeof feedScoutSettings.$inferSelect | undefined,
): FeedScoutSettings {
  return {
    botToken: row?.botToken ?? "",
    botUsername: row?.botUsername ?? "",
    xrocketPayKey: row?.xrocketPayKey ?? "",
    payoutAmount: Number(row?.payoutAmount ?? 1),
    payoutCurrency: (row?.payoutCurrency ?? "USDT").trim() || "USDT",
    enabled: row?.enabled !== false,
    webhookSecret: row?.webhookSecret ?? "",
    updatedAt: row?.updatedAt ?? "",
  };
}

function toPublic(settings: FeedScoutSettings): FeedScoutSettingsPublic {
  return {
    botUsername: settings.botUsername,
    payoutAmount: settings.payoutAmount,
    payoutCurrency: settings.payoutCurrency,
    enabled: settings.enabled,
    updatedAt: settings.updatedAt,
    hasBotToken: Boolean(settings.botToken.trim()),
    botTokenHint: maskBotToken(settings.botToken),
    hasXrocketPayKey: Boolean(settings.xrocketPayKey.trim()),
    xrocketPayKeyHint: maskSecret(settings.xrocketPayKey),
    hasWebhookSecret: Boolean(settings.webhookSecret.trim()),
  };
}

async function ensureSettingsRow(): Promise<FeedScoutSettings> {
  await runMigrations();
  const db = getDb();
  const [row] = await db
    .select()
    .from(feedScoutSettings)
    .where(eq(feedScoutSettings.id, 1))
    .limit(1);
  if (row) return mapSettings(row);

  const envToken = process.env.FEED_SCOUT_BOT_TOKEN?.trim() ?? "";
  const envKey = process.env.XROCKET_PAY_KEY?.trim() ?? "";
  const secret = randomBytes(24).toString("hex");
  const now = new Date().toISOString();
  await db.insert(feedScoutSettings).values({
    id: 1,
    botToken: envToken,
    botUsername: "",
    xrocketPayKey: envKey,
    payoutAmount: 1,
    payoutCurrency: "USDT",
    enabled: true,
    webhookSecret: secret,
    updatedAt: now,
  });
  return mapSettings({
    id: 1,
    botToken: envToken,
    botUsername: "",
    xrocketPayKey: envKey,
    payoutAmount: 1,
    payoutCurrency: "USDT",
    enabled: true,
    webhookSecret: secret,
    updatedAt: now,
  });
}

export async function getFeedScoutSettings(): Promise<FeedScoutSettings> {
  return ensureSettingsRow();
}

export async function getFeedScoutSettingsPublic(): Promise<FeedScoutSettingsPublic> {
  return toPublic(await ensureSettingsRow());
}

export async function updateFeedScoutSettings(patch: {
  botToken?: string;
  xrocketPayKey?: string;
  payoutAmount?: number;
  payoutCurrency?: string;
  enabled?: boolean;
  rotateWebhookSecret?: boolean;
}): Promise<FeedScoutSettingsPublic> {
  const current = await ensureSettingsRow();
  const db = getDb();
  const now = new Date().toISOString();

  let botToken = current.botToken;
  if (typeof patch.botToken === "string" && patch.botToken.trim()) {
    botToken = patch.botToken.trim();
  }

  let xrocketPayKey = current.xrocketPayKey;
  if (typeof patch.xrocketPayKey === "string" && patch.xrocketPayKey.trim()) {
    xrocketPayKey = patch.xrocketPayKey.trim();
  }

  let payoutAmount = current.payoutAmount;
  if (
    typeof patch.payoutAmount === "number" &&
    Number.isFinite(patch.payoutAmount) &&
    patch.payoutAmount >= 0
  ) {
    payoutAmount = patch.payoutAmount;
  }

  let payoutCurrency = current.payoutCurrency;
  if (typeof patch.payoutCurrency === "string" && patch.payoutCurrency.trim()) {
    payoutCurrency = patch.payoutCurrency.trim().toUpperCase();
  }

  let webhookSecret = current.webhookSecret;
  if (patch.rotateWebhookSecret || !webhookSecret) {
    webhookSecret = randomBytes(24).toString("hex");
  }

  let botUsername = current.botUsername;
  if (botToken && botToken !== current.botToken) {
    try {
      const me = await scoutTgGetMe(botToken);
      botUsername = me.username ?? "";
    } catch {
      // keep previous username; connection test will surface errors
    }
  }

  await db
    .update(feedScoutSettings)
    .set({
      botToken,
      botUsername,
      xrocketPayKey,
      payoutAmount,
      payoutCurrency,
      enabled: patch.enabled ?? current.enabled,
      webhookSecret,
      updatedAt: now,
    })
    .where(eq(feedScoutSettings.id, 1));

  return toPublic(await ensureSettingsRow());
}

export async function testFeedScoutBot(): Promise<{
  ok: boolean;
  username: string;
  error?: string;
}> {
  const settings = await ensureSettingsRow();
  if (!settings.botToken.trim()) {
    return { ok: false, username: "", error: "Bot token не задан" };
  }
  try {
    const me = await scoutTgGetMe(settings.botToken);
    const username = me.username ?? "";
    const db = getDb();
    await db
      .update(feedScoutSettings)
      .set({ botUsername: username, updatedAt: new Date().toISOString() })
      .where(eq(feedScoutSettings.id, 1));
    return { ok: true, username };
  } catch (error) {
    return {
      ok: false,
      username: "",
      error: error instanceof Error ? error.message : "Ошибка Telegram",
    };
  }
}

export async function testFeedScoutXrocket(): Promise<{
  ok: boolean;
  appName?: string;
  balances?: Array<{ currency: string; balance: number }>;
  error?: string;
}> {
  const settings = await ensureSettingsRow();
  if (!settings.xrocketPayKey.trim()) {
    return { ok: false, error: "xRocket Pay key не задан" };
  }
  try {
    const info = await xrocketGetAppInfo(settings.xrocketPayKey);
    return {
      ok: true,
      appName: info.name,
      balances: info.balances.map((b) => ({
        currency: String(b.currency),
        balance: Number(b.balance),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ошибка xRocket",
    };
  }
}

async function siteOrigin(): Promise<string> {
  try {
    const seo = await getSeoSettings();
    const fromSeo = (seo.siteUrl ?? "").trim().replace(/\/$/, "");
    if (fromSeo) return fromSeo;
  } catch {
    // ignore
  }
  return (process.env.SITE_URL ?? "https://gapsnap.org").trim().replace(/\/$/, "");
}

export async function setFeedScoutWebhook(): Promise<{
  ok: boolean;
  url: string;
  error?: string;
}> {
  const settings = await ensureSettingsRow();
  if (!settings.botToken.trim()) {
    return { ok: false, url: "", error: "Bot token не задан" };
  }
  let secret = settings.webhookSecret;
  if (!secret) {
    secret = randomBytes(24).toString("hex");
    const db = getDb();
    await db
      .update(feedScoutSettings)
      .set({ webhookSecret: secret, updatedAt: new Date().toISOString() })
      .where(eq(feedScoutSettings.id, 1));
  }
  const url = `${await siteOrigin()}/api/telegram/feed-scout`;
  try {
    await scoutTgSetWebhook(settings.botToken, {
      url,
      secretToken: secret,
    });
    return { ok: true, url };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : "setWebhook failed",
    };
  }
}

export async function deleteFeedScoutWebhook(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const settings = await ensureSettingsRow();
  if (!settings.botToken.trim()) {
    return { ok: false, error: "Bot token не задан" };
  }
  try {
    await scoutTgDeleteWebhook(settings.botToken);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "deleteWebhook failed",
    };
  }
}

export async function getFeedScoutWebhookInfo(): Promise<{
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage?: string;
  expectedUrl: string;
}> {
  const settings = await ensureSettingsRow();
  const expectedUrl = `${await siteOrigin()}/api/telegram/feed-scout`;
  if (!settings.botToken.trim()) {
    return { url: "", pendingUpdateCount: 0, expectedUrl };
  }
  try {
    const info = await scoutTgGetWebhookInfo(settings.botToken);
    return {
      url: info.url ?? "",
      pendingUpdateCount: info.pending_update_count ?? 0,
      lastErrorMessage: info.last_error_message,
      expectedUrl,
    };
  } catch {
    return { url: "", pendingUpdateCount: 0, expectedUrl };
  }
}

function mapWorkerStatus(value: string): FeedScoutWorkerStatus {
  return value === "banned" ? "banned" : "active";
}

function mapPayoutStatus(value: string): FeedScoutPayoutStatus {
  if (value === "paid" || value === "failed") return value;
  return "none";
}

function normalizeLinkQuota(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function toWorkerView(
  row: typeof feedScoutWorkers.$inferSelect,
  stats:
    | {
        acceptedCount: number;
        paidTotal: number;
        failedPayouts: number;
        lastSubmissionAt: string | null;
      }
    | undefined,
  payoutAmount: number,
): FeedScoutWorker {
  const acceptedCount = stats?.acceptedCount ?? 0;
  const linkQuota = normalizeLinkQuota(row.linkQuota);
  const linksRemaining =
    linkQuota === null ? null : Math.max(0, linkQuota - acceptedCount);
  const budgetReserved =
    linksRemaining === null ? 0 : linksRemaining * payoutAmount;
  return {
    id: row.id,
    tgUserId: row.tgUserId,
    username: row.username,
    firstName: row.firstName,
    status: mapWorkerStatus(row.status),
    linkQuota,
    linksRemaining,
    budgetReserved,
    adminNote: row.adminNote ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    acceptedCount,
    paidTotal: stats?.paidTotal ?? 0,
    failedPayouts: stats?.failedPayouts ?? 0,
    lastSubmissionAt: stats?.lastSubmissionAt ?? null,
  };
}

async function getWorkerAcceptedCount(workerId: string): Promise<number> {
  const stats = await workerStatsMap([workerId]);
  return stats.get(workerId)?.acceptedCount ?? 0;
}

async function assertWorkerHasQuota(
  workerId: string,
): Promise<{ ok: true; remaining: number | null } | { ok: false; reason: string }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(feedScoutWorkers)
    .where(eq(feedScoutWorkers.id, workerId))
    .limit(1);
  if (!row) return { ok: false, reason: "Воркер не найден" };
  const linkQuota = normalizeLinkQuota(row.linkQuota);
  if (linkQuota === null) return { ok: true, remaining: null };
  const accepted = await getWorkerAcceptedCount(workerId);
  const remaining = linkQuota - accepted;
  if (remaining <= 0) {
    return {
      ok: false,
      reason: `Лимит ссылок исчерпан. Остаток квоты: <b>0</b> из ${linkQuota}. Дождитесь новой квоты от администратора (/quota).`,
    };
  }
  return { ok: true, remaining };
}

export async function upsertFeedScoutWorker(input: {
  tgUserId: number | string;
  username?: string;
  firstName?: string;
}): Promise<FeedScoutWorker> {
  await ensureSettingsRow();
  const db = getDb();
  const tgUserId = String(input.tgUserId);
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(feedScoutWorkers)
    .where(eq(feedScoutWorkers.tgUserId, tgUserId))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(feedScoutWorkers)
      .set({
        username: (input.username ?? existing.username ?? "").replace(/^@/, ""),
        firstName: input.firstName ?? existing.firstName,
        updatedAt: now,
      })
      .where(eq(feedScoutWorkers.id, existing.id))
      .returning();
    const settings = await ensureSettingsRow();
    const stats = await workerStatsMap([row.id]);
    return toWorkerView(row, stats.get(row.id), settings.payoutAmount);
  }

  const id = newId("fsw");
  const [row] = await db
    .insert(feedScoutWorkers)
    .values({
      id,
      tgUserId,
      username: (input.username ?? "").replace(/^@/, ""),
      firstName: input.firstName ?? "",
      status: "active",
      // New workers start with 0 until admin grants a quota from xRocket balance.
      linkQuota: 0,
      adminNote: "",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const settings = await ensureSettingsRow();
  return toWorkerView(row, undefined, settings.payoutAmount);
}

export async function setFeedScoutWorkerStatus(
  workerId: string,
  status: FeedScoutWorkerStatus,
): Promise<FeedScoutWorker | null> {
  const db = getDb();
  const [row] = await db
    .update(feedScoutWorkers)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(feedScoutWorkers.id, workerId))
    .returning();
  if (!row) return null;
  const settings = await ensureSettingsRow();
  const stats = await workerStatsMap([row.id]);
  return toWorkerView(row, stats.get(row.id), settings.payoutAmount);
}

/** Set absolute max accepted links (null = unlimited). */
export async function setFeedScoutWorkerQuota(
  workerId: string,
  linkQuota: number | null,
): Promise<FeedScoutWorker | null> {
  const db = getDb();
  const quota =
    linkQuota === null
      ? null
      : Math.max(0, Math.floor(Number(linkQuota)));
  if (linkQuota !== null && !Number.isFinite(quota as number)) {
    throw new Error("Некорректная квота");
  }
  const [row] = await db
    .update(feedScoutWorkers)
    .set({
      linkQuota: quota,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(feedScoutWorkers.id, workerId))
    .returning();
  if (!row) return null;
  const settings = await ensureSettingsRow();
  const stats = await workerStatsMap([row.id]);
  return toWorkerView(row, stats.get(row.id), settings.payoutAmount);
}

/** Grant N additional remaining slots (relative to current remaining). */
export async function grantFeedScoutWorkerLinks(
  workerId: string,
  addLinks: number,
): Promise<FeedScoutWorker | null> {
  const add = Math.floor(Number(addLinks));
  if (!Number.isFinite(add) || add <= 0) {
    throw new Error("addLinks must be > 0");
  }
  const db = getDb();
  const [row] = await db
    .select()
    .from(feedScoutWorkers)
    .where(eq(feedScoutWorkers.id, workerId))
    .limit(1);
  if (!row) return null;
  const accepted = await getWorkerAcceptedCount(workerId);
  const currentQuota = normalizeLinkQuota(row.linkQuota);
  const currentRemaining =
    currentQuota === null ? 0 : Math.max(0, currentQuota - accepted);
  // If unlimited, switch to accepted + add; if limited, add to remaining.
  const nextQuota = accepted + currentRemaining + add;
  return setFeedScoutWorkerQuota(workerId, nextQuota);
}

/** Set remaining slots exactly (quota = accepted + remaining). */
export async function setFeedScoutWorkerRemaining(
  workerId: string,
  remaining: number,
): Promise<FeedScoutWorker | null> {
  const rem = Math.floor(Number(remaining));
  if (!Number.isFinite(rem) || rem < 0) {
    throw new Error("remaining must be >= 0");
  }
  const accepted = await getWorkerAcceptedCount(workerId);
  return setFeedScoutWorkerQuota(workerId, accepted + rem);
}

export async function updateFeedScoutWorkerNote(
  workerId: string,
  adminNote: string,
): Promise<FeedScoutWorker | null> {
  const db = getDb();
  const [row] = await db
    .update(feedScoutWorkers)
    .set({
      adminNote: (adminNote ?? "").trim().slice(0, 2000),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(feedScoutWorkers.id, workerId))
    .returning();
  if (!row) return null;
  const settings = await ensureSettingsRow();
  const stats = await workerStatsMap([row.id]);
  return toWorkerView(row, stats.get(row.id), settings.payoutAmount);
}

/** Zero remaining for all active workers (keep accepted history). */
export async function zeroAllFeedScoutQuotas(): Promise<number> {
  const workers = await listFeedScoutWorkers();
  let n = 0;
  for (const w of workers) {
    if (w.status === "banned") continue;
    if (w.linkQuota === null || (w.linksRemaining ?? 0) > 0) {
      await setFeedScoutWorkerRemaining(w.id, 0);
      n += 1;
    }
  }
  return n;
}

export async function retryAllFailedFeedScoutPayouts(): Promise<{
  retried: number;
  paid: number;
  stillFailed: number;
}> {
  const db = getDb();
  const failed = await db
    .select({
      submission: feedScoutSubmissions,
      worker: feedScoutWorkers,
    })
    .from(feedScoutSubmissions)
    .innerJoin(
      feedScoutWorkers,
      eq(feedScoutSubmissions.workerId, feedScoutWorkers.id),
    )
    .where(eq(feedScoutSubmissions.payoutStatus, "failed"))
    .orderBy(feedScoutSubmissions.createdAt)
    .limit(200);

  let paid = 0;
  let stillFailed = 0;
  for (const row of failed) {
    if (row.worker.status === "banned") {
      stillFailed += 1;
      continue;
    }
    const payout = await paySubmission({
      submissionId: row.submission.id,
      tgUserId: row.worker.tgUserId,
      amount: row.submission.amount,
      currency: row.submission.currency,
    });
    if (payout.ok) {
      paid += 1;
      await db
        .update(feedScoutSubmissions)
        .set({
          payoutStatus: "paid",
          xrocketTransferId: String(payout.transferId),
          payoutError: null,
          paidAt: new Date().toISOString(),
        })
        .where(eq(feedScoutSubmissions.id, row.submission.id));
    } else {
      stillFailed += 1;
      await db
        .update(feedScoutSubmissions)
        .set({ payoutError: payout.error })
        .where(eq(feedScoutSubmissions.id, row.submission.id));
    }
  }
  return { retried: failed.length, paid, stillFailed };
}

async function workerStatsMap(
  workerIds: string[],
): Promise<
  Map<
    string,
    {
      acceptedCount: number;
      paidTotal: number;
      failedPayouts: number;
      lastSubmissionAt: string | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      acceptedCount: number;
      paidTotal: number;
      failedPayouts: number;
      lastSubmissionAt: string | null;
    }
  >();
  if (workerIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select({
      workerId: feedScoutSubmissions.workerId,
      acceptedCount: sql<number>`count(*)::int`,
      paidTotal: sql<number>`coalesce(sum(case when ${feedScoutSubmissions.payoutStatus} = 'paid' then ${feedScoutSubmissions.amount} else 0 end), 0)`,
      failedPayouts: sql<number>`count(*) filter (where ${feedScoutSubmissions.payoutStatus} = 'failed')::int`,
      lastSubmissionAt: sql<string | null>`max(${feedScoutSubmissions.createdAt})`,
    })
    .from(feedScoutSubmissions)
    .where(inArray(feedScoutSubmissions.workerId, workerIds))
    .groupBy(feedScoutSubmissions.workerId);

  for (const row of rows) {
    map.set(row.workerId, {
      acceptedCount: Number(row.acceptedCount) || 0,
      paidTotal: Number(row.paidTotal) || 0,
      failedPayouts: Number(row.failedPayouts) || 0,
      lastSubmissionAt: row.lastSubmissionAt ?? null,
    });
  }
  return map;
}

export async function listFeedScoutWorkers(): Promise<FeedScoutWorker[]> {
  const settings = await ensureSettingsRow();
  const db = getDb();
  const rows = await db
    .select()
    .from(feedScoutWorkers)
    .orderBy(desc(feedScoutWorkers.createdAt));
  const stats = await workerStatsMap(rows.map((r) => r.id));
  return rows.map((row) =>
    toWorkerView(row, stats.get(row.id), settings.payoutAmount),
  );
}

export async function listFeedScoutSubmissions(limit = 100): Promise<
  FeedScoutSubmission[]
> {
  await ensureSettingsRow();
  const db = getDb();
  const rows = await db
    .select({
      submission: feedScoutSubmissions,
      workerTgUserId: feedScoutWorkers.tgUserId,
      workerUsername: feedScoutWorkers.username,
    })
    .from(feedScoutSubmissions)
    .innerJoin(
      feedScoutWorkers,
      eq(feedScoutSubmissions.workerId, feedScoutWorkers.id),
    )
    .orderBy(desc(feedScoutSubmissions.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  return rows.map(({ submission: s, workerTgUserId, workerUsername }) => ({
    id: s.id,
    workerId: s.workerId,
    workerTgUserId,
    workerUsername,
    feedUrl: s.feedUrl,
    feedUrlNorm: s.feedUrlNorm,
    exchangerId: s.exchangerId,
    pairCount: s.pairCount,
    amount: s.amount,
    currency: s.currency,
    payoutStatus: mapPayoutStatus(s.payoutStatus),
    xrocketTransferId: s.xrocketTransferId,
    payoutError: s.payoutError,
    createdAt: s.createdAt,
    paidAt: s.paidAt,
  }));
}

export async function getWorkerStatsByTgUserId(tgUserId: string): Promise<{
  acceptedCount: number;
  paidTotal: number;
  failedPayouts: number;
  status: FeedScoutWorkerStatus;
  linkQuota: number | null;
  linksRemaining: number | null;
}> {
  const db = getDb();
  const [worker] = await db
    .select()
    .from(feedScoutWorkers)
    .where(eq(feedScoutWorkers.tgUserId, String(tgUserId)))
    .limit(1);
  if (!worker) {
    return {
      acceptedCount: 0,
      paidTotal: 0,
      failedPayouts: 0,
      status: "active",
      linkQuota: 0,
      linksRemaining: 0,
    };
  }
  const settings = await ensureSettingsRow();
  const stats = await workerStatsMap([worker.id]);
  const view = toWorkerView(worker, stats.get(worker.id), settings.payoutAmount);
  return {
    acceptedCount: view.acceptedCount,
    paidTotal: view.paidTotal,
    failedPayouts: view.failedPayouts,
    status: view.status,
    linkQuota: view.linkQuota,
    linksRemaining: view.linksRemaining,
  };
}

async function feedUrlAlreadyTaken(norm: string): Promise<string | null> {
  const db = getDb();
  const [sub] = await db
    .select({ id: feedScoutSubmissions.id })
    .from(feedScoutSubmissions)
    .where(eq(feedScoutSubmissions.feedUrlNorm, norm))
    .limit(1);
  if (sub) return "Эта ссылка уже принята у другого или этого воркера";

  const rows = await db
    .select({ id: exchangers.id, feedUrl: exchangers.feedUrl })
    .from(exchangers);
  for (const row of rows) {
    const existingNorm = normalizeFeedUrl(row.feedUrl);
    if (existingNorm && existingNorm === norm) {
      return "Такой XML-фид уже есть в GapSnap";
    }
  }
  return null;
}

async function paySubmission(input: {
  submissionId: string;
  tgUserId: string;
  amount: number;
  currency: string;
}): Promise<{ ok: true; transferId: number } | { ok: false; error: string }> {
  const settings = await ensureSettingsRow();
  if (!settings.xrocketPayKey.trim()) {
    return { ok: false, error: "xRocket Pay key не настроен" };
  }
  if (input.amount <= 0) {
    return { ok: false, error: "Сумма выплаты = 0 (настройте в админке)" };
  }
  const tgUserId = Number(input.tgUserId);
  if (!Number.isFinite(tgUserId) || tgUserId <= 0) {
    return { ok: false, error: "Некорректный Telegram ID" };
  }
  try {
    const result = await xrocketTransfer(settings.xrocketPayKey, {
      tgUserId,
      currency: input.currency,
      amount: input.amount,
      transferId: input.submissionId,
      // xRocket rejects descriptions that contain URLs / contacts.
      description: `GapSnap feed scout #${input.submissionId}`,
    });
    return { ok: true, transferId: result.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ошибка выплаты",
    };
  }
}

export async function processFeedUrlForWorker(input: {
  workerId: string;
  tgUserId: string;
  feedUrl: string;
}): Promise<FeedScoutUrlResult> {
  const settings = await ensureSettingsRow();
  const raw = input.feedUrl.trim();
  const norm = normalizeFeedUrl(raw);
  if (!norm) {
    return { url: raw, ok: false, reason: "Некорректный URL" };
  }

  const quota = await assertWorkerHasQuota(input.workerId);
  if (!quota.ok) {
    return { url: raw, ok: false, reason: quota.reason };
  }

  const taken = await feedUrlAlreadyTaken(norm);
  if (taken) {
    return { url: raw, ok: false, reason: taken };
  }

  try {
    await assertSafeOutboundUrl(norm, { allowHttp: true });
  } catch (error) {
    return {
      url: raw,
      ok: false,
      reason:
        error instanceof Error ? error.message : "URL заблокирован (SSRF)",
    };
  }

  let pairCount = 0;
  let items: Awaited<ReturnType<typeof validateFeedUrl>>["items"] = [];
  try {
    const validated = await validateFeedUrl(norm);
    items = validated.items;
    pairCount = validated.pairCount;
    if (pairCount <= 0) {
      return { url: raw, ok: false, reason: "XML пустой (0 пар)" };
    }
  } catch (error) {
    return {
      url: raw,
      ok: false,
      reason:
        error instanceof Error
          ? `Фид невалиден: ${error.message}`
          : "Фид невалиден",
    };
  }

  const enrichment = await enrichExchangerFromFeedUrl(norm);
  const exchangerId = newId("ex");
  let logoSaved = false;

  try {
    await createExchangerManual({
      id: exchangerId,
      name: enrichment.name,
      website: enrichment.website,
      feedUrl: norm,
      contact: enrichment.contact,
      description: enrichment.description,
      ownerEmail: enrichment.ownerEmail,
      pairCount,
      status: "pending",
    });
    await replaceExchangerRates(exchangerId, items, { ok: true });
    if (enrichment.logo) {
      try {
        await saveExchangerLogo(exchangerId, enrichment.logo);
        logoSaved = true;
      } catch {
        // Logo is best-effort; card is already created.
      }
    }
  } catch (error) {
    return {
      url: raw,
      ok: false,
      reason:
        error instanceof Error
          ? `Не удалось создать обменник: ${error.message}`
          : "Не удалось создать обменник",
    };
  }

  const enrichmentSummary = {
    name: enrichment.name,
    contact: enrichment.contact,
    emails: enrichment.emails,
    telegrams: enrichment.telegrams,
    logoSaved,
  };

  const db = getDb();
  const submissionId = newId("fss");
  const now = new Date().toISOString();
  const amount = settings.payoutAmount;
  const currency = settings.payoutCurrency;

  try {
    await db.insert(feedScoutSubmissions).values({
      id: submissionId,
      workerId: input.workerId,
      feedUrl: raw,
      feedUrlNorm: norm,
      exchangerId,
      pairCount,
      amount,
      currency,
      payoutStatus: "none",
      xrocketTransferId: null,
      payoutError: null,
      createdAt: now,
      paidAt: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("feed_scout_submissions_norm_uidx") || message.includes("unique")) {
      return {
        url: raw,
        ok: false,
        reason: "Эта ссылка уже принята (гонка с другим воркером)",
      };
    }
    return {
      url: raw,
      ok: false,
      reason: `Ошибка записи: ${message || "unknown"}`,
    };
  }

  const payout = await paySubmission({
    submissionId,
    tgUserId: input.tgUserId,
    amount,
    currency,
  });

  if (payout.ok) {
    await db
      .update(feedScoutSubmissions)
      .set({
        payoutStatus: "paid",
        xrocketTransferId: String(payout.transferId),
        payoutError: null,
        paidAt: new Date().toISOString(),
      })
      .where(eq(feedScoutSubmissions.id, submissionId));
    return {
      url: raw,
      ok: true,
      exchangerId,
      pairCount,
      amount,
      currency,
      payoutStatus: "paid",
      enrichment: enrichmentSummary,
    };
  }

  await db
    .update(feedScoutSubmissions)
    .set({
      payoutStatus: "failed",
      payoutError: payout.error,
    })
    .where(eq(feedScoutSubmissions.id, submissionId));

  return {
    url: raw,
    ok: true,
    exchangerId,
    pairCount,
    amount,
    currency,
    payoutStatus: "failed",
    payoutError: payout.error,
    enrichment: enrichmentSummary,
  };
}

export async function retryFailedPayoutsForWorker(
  tgUserId: string,
): Promise<{ retried: number; paid: number; stillFailed: number }> {
  const db = getDb();
  const [worker] = await db
    .select()
    .from(feedScoutWorkers)
    .where(eq(feedScoutWorkers.tgUserId, String(tgUserId)))
    .limit(1);
  if (!worker || worker.status === "banned") {
    return { retried: 0, paid: 0, stillFailed: 0 };
  }

  const failed = await db
    .select()
    .from(feedScoutSubmissions)
    .where(
      and(
        eq(feedScoutSubmissions.workerId, worker.id),
        eq(feedScoutSubmissions.payoutStatus, "failed"),
      ),
    )
    .orderBy(feedScoutSubmissions.createdAt)
    .limit(50);

  let paid = 0;
  let stillFailed = 0;
  for (const row of failed) {
    const payout = await paySubmission({
      submissionId: row.id,
      tgUserId: worker.tgUserId,
      amount: row.amount,
      currency: row.currency,
    });
    if (payout.ok) {
      paid += 1;
      await db
        .update(feedScoutSubmissions)
        .set({
          payoutStatus: "paid",
          xrocketTransferId: String(payout.transferId),
          payoutError: null,
          paidAt: new Date().toISOString(),
        })
        .where(eq(feedScoutSubmissions.id, row.id));
    } else {
      stillFailed += 1;
      await db
        .update(feedScoutSubmissions)
        .set({ payoutError: payout.error })
        .where(eq(feedScoutSubmissions.id, row.id));
    }
  }
  return { retried: failed.length, paid, stillFailed };
}

export async function retryFeedScoutPayout(
  submissionId: string,
): Promise<FeedScoutSubmission | null> {
  const db = getDb();
  const [row] = await db
    .select({
      submission: feedScoutSubmissions,
      worker: feedScoutWorkers,
    })
    .from(feedScoutSubmissions)
    .innerJoin(
      feedScoutWorkers,
      eq(feedScoutSubmissions.workerId, feedScoutWorkers.id),
    )
    .where(eq(feedScoutSubmissions.id, submissionId))
    .limit(1);
  if (!row) return null;
  if (row.submission.payoutStatus === "paid") {
    return {
      id: row.submission.id,
      workerId: row.submission.workerId,
      workerTgUserId: row.worker.tgUserId,
      workerUsername: row.worker.username,
      feedUrl: row.submission.feedUrl,
      feedUrlNorm: row.submission.feedUrlNorm,
      exchangerId: row.submission.exchangerId,
      pairCount: row.submission.pairCount,
      amount: row.submission.amount,
      currency: row.submission.currency,
      payoutStatus: "paid",
      xrocketTransferId: row.submission.xrocketTransferId,
      payoutError: row.submission.payoutError,
      createdAt: row.submission.createdAt,
      paidAt: row.submission.paidAt,
    };
  }

  const payout = await paySubmission({
    submissionId: row.submission.id,
    tgUserId: row.worker.tgUserId,
    amount: row.submission.amount,
    currency: row.submission.currency,
  });

  if (payout.ok) {
    const [updated] = await db
      .update(feedScoutSubmissions)
      .set({
        payoutStatus: "paid",
        xrocketTransferId: String(payout.transferId),
        payoutError: null,
        paidAt: new Date().toISOString(),
      })
      .where(eq(feedScoutSubmissions.id, submissionId))
      .returning();
    return {
      id: updated.id,
      workerId: updated.workerId,
      workerTgUserId: row.worker.tgUserId,
      workerUsername: row.worker.username,
      feedUrl: updated.feedUrl,
      feedUrlNorm: updated.feedUrlNorm,
      exchangerId: updated.exchangerId,
      pairCount: updated.pairCount,
      amount: updated.amount,
      currency: updated.currency,
      payoutStatus: "paid",
      xrocketTransferId: updated.xrocketTransferId,
      payoutError: updated.payoutError,
      createdAt: updated.createdAt,
      paidAt: updated.paidAt,
    };
  }

  const [updated] = await db
    .update(feedScoutSubmissions)
    .set({
      payoutStatus: "failed",
      payoutError: payout.error,
    })
    .where(eq(feedScoutSubmissions.id, submissionId))
    .returning();

  return {
    id: updated.id,
    workerId: updated.workerId,
    workerTgUserId: row.worker.tgUserId,
    workerUsername: row.worker.username,
    feedUrl: updated.feedUrl,
    feedUrlNorm: updated.feedUrlNorm,
    exchangerId: updated.exchangerId,
    pairCount: updated.pairCount,
    amount: updated.amount,
    currency: updated.currency,
    payoutStatus: "failed",
    xrocketTransferId: updated.xrocketTransferId,
    payoutError: updated.payoutError,
    createdAt: updated.createdAt,
    paidAt: updated.paidAt,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatQuotaLine(quota: {
  linkQuota: number | null;
  linksRemaining: number | null;
}): string {
  if (quota.linkQuota === null) {
    return "Остаток квоты: <b>без лимита</b>";
  }
  const left = quota.linksRemaining ?? 0;
  if (left <= 0) {
    return `Остаток квоты: <b>0</b> из ${quota.linkQuota} (лимит исчерпан)`;
  }
  return `Остаток квоты: <b>${left}</b> из ${quota.linkQuota}`;
}

function helpText(
  settings: FeedScoutSettings,
  quota?: { linkQuota: number | null; linksRemaining: number | null },
): string {
  return [
    "<b>GapSnap Feed Scout</b>",
    "",
    "Пришлите одну или несколько ссылок на XML-фиды обменников.",
    `Ставка: <b>${settings.payoutAmount} ${settings.payoutCurrency}</b> за принятую ссылку.`,
    quota
      ? formatQuotaLine(quota)
      : "Квота выдаётся администратором",
    "",
    "Принимаем только валидные новые фиды (которых ещё нет в GapSnap).",
    "После принятия сразу сканируем сайт обменника: имя, контакты, описание, логотип (если удаётся).",
    "Выплата на ваш Telegram через @xRocket — откройте бота хотя бы раз.",
    "",
    "Команды:",
    "/start — это сообщение",
    "/quota — текущий остаток квоты",
    "/stats — статистика",
    "/retry — повторить неудачные выплаты",
    "/help — справка",
  ].join("\n");
}

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: {
      id: number;
      is_bot?: boolean;
      first_name?: string;
      username?: string;
    };
  };
};

export async function handleFeedScoutUpdate(
  update: TelegramUpdate,
): Promise<void> {
  const settings = await ensureSettingsRow();
  const message = update.message;
  if (!message?.from || message.from.is_bot) return;
  if (!message.text?.trim()) return;
  if (message.chat.type !== "private") {
    // only DMs
    return;
  }

  const token = settings.botToken;
  if (!token.trim() || !settings.enabled) {
    if (token.trim()) {
      await scoutTgSendMessage(
        token,
        message.chat.id,
        "Бот временно выключен. Напишите позже.",
      );
    }
    return;
  }

  const worker = await upsertFeedScoutWorker({
    tgUserId: message.from.id,
    username: message.from.username,
    firstName: message.from.first_name,
  });

  if (worker.status === "banned") {
    await scoutTgSendMessage(
      token,
      message.chat.id,
      "Доступ заблокирован. Обратитесь к администратору.",
    );
    return;
  }

  const text = message.text.trim();
  const command = text.split(/\s+/)[0]?.toLowerCase().replace(/@\w+$/, "") ?? "";

  if (command === "/start" || command === "/help") {
    const stats = await getWorkerStatsByTgUserId(String(message.from.id));
    await scoutTgSendMessage(
      token,
      message.chat.id,
      helpText(settings, {
        linkQuota: stats.linkQuota,
        linksRemaining: stats.linksRemaining,
      }),
    );
    return;
  }

  if (command === "/quota" || command === "/квота") {
    const stats = await getWorkerStatsByTgUserId(String(message.from.id));
    await scoutTgSendMessage(
      token,
      message.chat.id,
      [
        "<b>Ваша квота</b>",
        formatQuotaLine({
          linkQuota: stats.linkQuota,
          linksRemaining: stats.linksRemaining,
        }),
        `Принято всего: <b>${stats.acceptedCount}</b>`,
        `Ставка: ${settings.payoutAmount} ${settings.payoutCurrency} за ссылку`,
      ].join("\n"),
    );
    return;
  }

  if (command === "/stats") {
    const stats = await getWorkerStatsByTgUserId(String(message.from.id));
    await scoutTgSendMessage(
      token,
      message.chat.id,
      [
        "<b>Ваша статистика</b>",
        formatQuotaLine({
          linkQuota: stats.linkQuota,
          linksRemaining: stats.linksRemaining,
        }),
        `Принято ссылок: <b>${stats.acceptedCount}</b>`,
        `Выплачено: <b>${stats.paidTotal} ${settings.payoutCurrency}</b>`,
        `Неудачных выплат: <b>${stats.failedPayouts}</b>`,
        stats.failedPayouts > 0
          ? "\nОткройте @xRocket и отправьте /retry"
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return;
  }

  if (command === "/retry") {
    const result = await retryFailedPayoutsForWorker(String(message.from.id));
    await scoutTgSendMessage(
      token,
      message.chat.id,
      result.retried === 0
        ? "Нет неудачных выплат для повтора."
        : `Повтор: ${result.retried}. Успешно: ${result.paid}. Снова ошибка: ${result.stillFailed}.`,
    );
    return;
  }

  const urls = extractUrlsFromText(text);
  if (urls.length === 0) {
    await scoutTgSendMessage(
      token,
      message.chat.id,
      "Не вижу ссылок. Пришлите URL XML-фида (http/https) или /help.",
    );
    return;
  }

  const quotaCheck = await assertWorkerHasQuota(worker.id);
  if (!quotaCheck.ok) {
    await scoutTgSendMessage(token, message.chat.id, quotaCheck.reason);
    return;
  }

  const batch = urls.slice(0, MAX_URLS_PER_MESSAGE);
  const results: FeedScoutUrlResult[] = [];
  for (const url of batch) {
    const again = await assertWorkerHasQuota(worker.id);
    if (!again.ok) {
      results.push({ url, ok: false, reason: again.reason });
      // Mark remaining URLs in this batch as quota-blocked without fetching.
      for (const rest of batch.slice(results.length)) {
        results.push({ url: rest, ok: false, reason: again.reason });
      }
      break;
    }
    results.push(
      await processFeedUrlForWorker({
        workerId: worker.id,
        tgUserId: String(message.from.id),
        feedUrl: url,
      }),
    );
  }

  const accepted = results.filter((r) => r.ok);
  const rejected = results.filter((r) => !r.ok);
  const paidSum = accepted
    .filter((r) => r.ok && r.payoutStatus === "paid")
    .reduce((sum, r) => sum + (r.ok ? r.amount : 0), 0);
  const failedPay = accepted.filter((r) => r.ok && r.payoutStatus === "failed");

  const lines: string[] = [
    `<b>Итог</b>: принято ${accepted.length}, отклонено ${rejected.length}`,
  ];
  if (urls.length > MAX_URLS_PER_MESSAGE) {
    lines.push(
      `(обработано первые ${MAX_URLS_PER_MESSAGE} из ${urls.length})`,
    );
  }
  for (const r of accepted) {
    if (!r.ok) continue;
    const pay =
      r.payoutStatus === "paid"
        ? `✅ ${r.amount} ${r.currency}`
        : `⚠️ фид принят, выплата не прошла: ${escapeHtml(r.payoutError ?? "")}`;
    const en = r.enrichment;
    const cardBits: string[] = [`пар: ${r.pairCount}`, pay];
    if (en?.name) cardBits.push(`имя: ${escapeHtml(en.name)}`);
    if (en?.contact) {
      cardBits.push(`контакт: ${escapeHtml(en.contact)}`);
    } else {
      cardBits.push("контакт: не найден");
    }
    if (en?.logoSaved) cardBits.push("логотип: ок");
    lines.push(`• ${escapeHtml(r.url)}\n  ${cardBits.join(", ")}`);
  }
  for (const r of rejected) {
    if (r.ok) continue;
    lines.push(`• ❌ ${escapeHtml(r.url)}\n  ${escapeHtml(r.reason)}`);
  }
  if (paidSum > 0) {
    lines.push(`\nВыплачено сейчас: <b>${paidSum} ${settings.payoutCurrency}</b>`);
  }
  if (failedPay.length > 0) {
    lines.push(
      "\nОткройте @xRocket (/start), затем пришлите /retry для повторной выплаты.",
    );
  }

  const afterStats = await getWorkerStatsByTgUserId(String(message.from.id));
  lines.push(
    "",
    formatQuotaLine({
      linkQuota: afterStats.linkQuota,
      linksRemaining: afterStats.linksRemaining,
    }),
  );
  if (
    afterStats.linkQuota !== null &&
    (afterStats.linksRemaining ?? 0) <= 0
  ) {
    lines.push("Новые ссылки пока не принимаются — дождитесь квоты от админа.");
  }

  await scoutTgSendMessage(token, message.chat.id, lines.join("\n"));
}

export async function getFeedScoutAdminSnapshot() {
  const [settings, workers, submissions, webhook, xrocket] = await Promise.all([
    getFeedScoutSettingsPublic(),
    listFeedScoutWorkers(),
    listFeedScoutSubmissions(100),
    getFeedScoutWebhookInfo(),
    testFeedScoutXrocket().catch((e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "fail",
    })),
  ]);

  const budgetReserved = workers
    .filter((w) => w.status === "active")
    .reduce((sum, w) => sum + w.budgetReserved, 0);
  const usdtBalance =
    xrocket.ok && Array.isArray(xrocket.balances)
      ? Number(
          xrocket.balances.find((b) => String(b.currency) === "USDT")
            ?.balance ?? 0,
        )
      : null;

  const freeCapacity =
    usdtBalance !== null
      ? Math.max(0, usdtBalance - budgetReserved)
      : null;
  const exhaustedWorkers = workers.filter(
    (w) =>
      w.status === "active" &&
      w.linkQuota !== null &&
      (w.linksRemaining ?? 0) <= 0,
  ).length;
  const failedPayoutsNow = submissions.filter(
    (s) => s.payoutStatus === "failed",
  ).length;

  return {
    settings,
    workers,
    submissions,
    webhook,
    xrocket,
    env: {
      hasBotToken: Boolean(process.env.FEED_SCOUT_BOT_TOKEN?.trim()),
      hasXrocketPayKey: Boolean(process.env.XROCKET_PAY_KEY?.trim()),
    },
    stats: {
      workers: workers.length,
      activeWorkers: workers.filter((w) => w.status === "active").length,
      bannedWorkers: workers.filter((w) => w.status === "banned").length,
      exhaustedWorkers,
      acceptedTotal: workers.reduce((s, w) => s + w.acceptedCount, 0),
      paidTotal: workers.reduce((s, w) => s + w.paidTotal, 0),
      failedPayouts: workers.reduce((s, w) => s + w.failedPayouts, 0),
      failedPayoutsNow,
      budgetReserved,
      freeUsdt: freeCapacity,
      usdtBalance,
      payoutAmount: settings.payoutAmount,
      payoutCurrency: settings.payoutCurrency,
      balanceLinkCapacity:
        usdtBalance !== null && settings.payoutAmount > 0
          ? Math.floor(usdtBalance / settings.payoutAmount)
          : null,
      freeLinkCapacity:
        freeCapacity !== null && settings.payoutAmount > 0
          ? Math.floor(freeCapacity / settings.payoutAmount)
          : null,
    },
  };
}
