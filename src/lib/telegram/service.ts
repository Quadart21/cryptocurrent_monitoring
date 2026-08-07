import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import { telegramPosts, telegramSettings } from "@/db/schema";
import {
  maskBotToken,
  tgDeleteMessage,
  tgEditMessageCaption,
  tgEditMessageText,
  tgGetChat,
  tgGetMe,
  tgSendMessage,
  tgSendPhoto,
} from "@/lib/telegram/client";
import {
  normalizeTelegramButtons,
  telegramReplyMarkup,
  telegramReplyMarkupOrClear,
} from "@/lib/telegram/buttons";
import type {
  TelegramButtonRow,
  TelegramConnectionInfo,
  TelegramParseMode,
  TelegramPost,
  TelegramPostStatus,
  TelegramSettings,
  TelegramSettingsPublic,
} from "@/lib/telegram/types";

const PARSE_MODES = new Set<TelegramParseMode>([
  "HTML",
  "MarkdownV2",
  "Markdown",
]);

function normalizeParseMode(value: unknown): TelegramParseMode {
  if (typeof value === "string" && PARSE_MODES.has(value as TelegramParseMode)) {
    return value as TelegramParseMode;
  }
  return "HTML";
}

function mapSettings(
  row: typeof telegramSettings.$inferSelect | undefined,
): TelegramSettings {
  return {
    botToken: row?.botToken ?? "",
    channelId: row?.channelId ?? "",
    parseMode: normalizeParseMode(row?.parseMode),
    disablePreview: Boolean(row?.disablePreview),
    silent: Boolean(row?.silent),
    botUsername: row?.botUsername ?? "",
    channelTitle: row?.channelTitle ?? "",
    lastPostAt: row?.lastPostAt ?? null,
    composeModel: row?.composeModel ?? "",
    composePrompt: row?.composePrompt ?? "",
    contentEnabled: Boolean(row?.contentEnabled),
    contentSpreadEnabled: row?.contentSpreadEnabled !== false,
    contentNewsEnabled: row?.contentNewsEnabled !== false,
    contentMinSpreadPct:
      typeof row?.contentMinSpreadPct === "number" &&
      Number.isFinite(row.contentMinSpreadPct)
        ? row.contentMinSpreadPct
        : 1.5,
    contentMinOffers:
      typeof row?.contentMinOffers === "number" && row.contentMinOffers >= 2
        ? Math.floor(row.contentMinOffers)
        : 3,
    contentMaxSpreadPerRun:
      typeof row?.contentMaxSpreadPerRun === "number" &&
      row.contentMaxSpreadPerRun >= 1
        ? Math.floor(row.contentMaxSpreadPerRun)
        : 3,
    contentSpreadCooldownHours:
      typeof row?.contentSpreadCooldownHours === "number" &&
      row.contentSpreadCooldownHours >= 1
        ? Math.floor(row.contentSpreadCooldownHours)
        : 6,
    contentAutoPublish: row?.contentAutoPublish !== false,
    contentMaxPostsPerDay:
      typeof row?.contentMaxPostsPerDay === "number" &&
      row.contentMaxPostsPerDay >= 1
        ? Math.floor(row.contentMaxPostsPerDay)
        : 12,
    contentMinIntervalMinutes:
      typeof row?.contentMinIntervalMinutes === "number" &&
      row.contentMinIntervalMinutes >= 0
        ? Math.floor(row.contentMinIntervalMinutes)
        : 20,
    contentQuietStartHour:
      typeof row?.contentQuietStartHour === "number"
        ? Math.min(23, Math.max(0, Math.floor(row.contentQuietStartHour)))
        : 1,
    contentQuietEndHour:
      typeof row?.contentQuietEndHour === "number"
        ? Math.min(23, Math.max(0, Math.floor(row.contentQuietEndHour)))
        : 8,
    contentIntervalMinutes:
      typeof row?.contentIntervalMinutes === "number" &&
      row.contentIntervalMinutes >= 5
        ? Math.min(180, Math.floor(row.contentIntervalMinutes))
        : 15,
    contentMaxNewsPerRun:
      typeof row?.contentMaxNewsPerRun === "number" &&
      row.contentMaxNewsPerRun >= 1
        ? Math.min(20, Math.floor(row.contentMaxNewsPerRun))
        : 5,
    contentNewsLookbackHours:
      typeof row?.contentNewsLookbackHours === "number" &&
      row.contentNewsLookbackHours >= 1
        ? Math.min(336, Math.floor(row.contentNewsLookbackHours))
        : 48,
    contentIncludeCash: Boolean(row?.contentIncludeCash),
    contentPairAllowlist: row?.contentPairAllowlist ?? "",
    contentPairBlocklist: row?.contentPairBlocklist ?? "",
    contentFooter: row?.contentFooter ?? "",
    contentSpreadButtonText:
      (row?.contentSpreadButtonText ?? "").trim() || "Смотреть курсы",
    contentNewsButtonText:
      (row?.contentNewsButtonText ?? "").trim() || "Читать статью",
    contentUtmCampaign: (row?.contentUtmCampaign ?? "").trim() || "content",
    contentWithNewsImage: row?.contentWithNewsImage !== false,
    contentPostSilent: Boolean(row?.contentPostSilent),
    contentDisablePreview: row?.contentDisablePreview !== false,
    contentLastRunAt: row?.contentLastRunAt ?? null,
    contentLastRunResult: row?.contentLastRunResult ?? "",
    updatedAt: row?.updatedAt ?? "",
  };
}

function toPublic(settings: TelegramSettings): TelegramSettingsPublic {
  const token = settings.botToken.trim();
  const { botToken: _omit, ...rest } = settings;
  void _omit;
  return {
    ...rest,
    hasBotToken: Boolean(token),
    botTokenHint: maskBotToken(token),
  };
}

function mapPost(row: typeof telegramPosts.$inferSelect): TelegramPost {
  const raw = (row.status || "sent") as string;
  const status: TelegramPostStatus =
    raw === "generating" ||
    raw === "draft" ||
    raw === "failed" ||
    raw === "deleted" ||
    raw === "sent"
      ? raw
      : "sent";
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    chatId: row.chatId,
    messageId: row.messageId ?? null,
    text: row.text,
    parseMode: normalizeParseMode(row.parseMode),
    disablePreview: Boolean(row.disablePreview),
    silent: Boolean(row.silent),
    photoUrl: row.photoUrl ?? "",
    buttons: normalizeTelegramButtons(row.buttons ?? []),
    topic: row.topic ?? "",
    progress: row.progress ?? "",
    withImage: Boolean(row.withImage),
    status,
    error: row.error ?? null,
    adminLogin: row.adminLogin ?? "",
  };
}

async function ensureSettingsRow(): Promise<void> {
  await runMigrations();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramSettings)
    .where(eq(telegramSettings.id, 1))
    .limit(1);
  if (row) return;

  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const envChannel = process.env.TELEGRAM_CHANNEL_ID?.trim() ?? "";
  await db
    .insert(telegramSettings)
    .values({
      id: 1,
      botToken: envToken,
      channelId: envChannel,
      parseMode: "HTML",
      disablePreview: false,
      silent: false,
      botUsername: "",
      channelTitle: "",
      lastPostAt: null,
      composeModel: "",
      composePrompt: "",
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

export async function getTelegramSettings(): Promise<TelegramSettings> {
  await ensureSettingsRow();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramSettings)
    .where(eq(telegramSettings.id, 1))
    .limit(1);
  return mapSettings(row);
}

export async function getTelegramSettingsPublic(): Promise<TelegramSettingsPublic> {
  return toPublic(await getTelegramSettings());
}

export async function updateTelegramSettings(patch: {
  botToken?: string;
  channelId?: string;
  parseMode?: TelegramParseMode;
  disablePreview?: boolean;
  silent?: boolean;
  botUsername?: string;
  channelTitle?: string;
  lastPostAt?: string | null;
  composeModel?: string;
  composePrompt?: string;
  contentEnabled?: boolean;
  contentSpreadEnabled?: boolean;
  contentNewsEnabled?: boolean;
  contentMinSpreadPct?: number;
  contentMinOffers?: number;
  contentMaxSpreadPerRun?: number;
  contentSpreadCooldownHours?: number;
  contentAutoPublish?: boolean;
  contentMaxPostsPerDay?: number;
  contentMinIntervalMinutes?: number;
  contentQuietStartHour?: number;
  contentQuietEndHour?: number;
  contentIntervalMinutes?: number;
  contentMaxNewsPerRun?: number;
  contentNewsLookbackHours?: number;
  contentIncludeCash?: boolean;
  contentPairAllowlist?: string;
  contentPairBlocklist?: string;
  contentFooter?: string;
  contentSpreadButtonText?: string;
  contentNewsButtonText?: string;
  contentUtmCampaign?: string;
  contentWithNewsImage?: boolean;
  contentPostSilent?: boolean;
  contentDisablePreview?: boolean;
}): Promise<TelegramSettingsPublic> {
  await ensureSettingsRow();
  const current = await getTelegramSettings();
  const now = new Date().toISOString();

  const nextToken =
    typeof patch.botToken === "string" && patch.botToken.trim()
      ? patch.botToken.trim()
      : current.botToken;

  const clampPct = (n: number) =>
    Math.min(50, Math.max(0.1, Number.isFinite(n) ? n : current.contentMinSpreadPct));
  const clampInt = (n: number, min: number, max: number, fallback: number) => {
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
  };
  const clampStr = (v: unknown, max: number, fallback: string) => {
    if (typeof v !== "string") return fallback;
    return v.slice(0, max);
  };

  const next = {
    botToken: nextToken,
    channelId:
      typeof patch.channelId === "string"
        ? patch.channelId.trim()
        : current.channelId,
    parseMode:
      patch.parseMode !== undefined
        ? normalizeParseMode(patch.parseMode)
        : current.parseMode,
    disablePreview:
      typeof patch.disablePreview === "boolean"
        ? patch.disablePreview
        : current.disablePreview,
    silent: typeof patch.silent === "boolean" ? patch.silent : current.silent,
    botUsername:
      typeof patch.botUsername === "string"
        ? patch.botUsername.trim()
        : current.botUsername,
    channelTitle:
      typeof patch.channelTitle === "string"
        ? patch.channelTitle.trim()
        : current.channelTitle,
    lastPostAt:
      patch.lastPostAt !== undefined ? patch.lastPostAt : current.lastPostAt,
    composeModel:
      typeof patch.composeModel === "string"
        ? patch.composeModel.trim()
        : current.composeModel,
    composePrompt:
      typeof patch.composePrompt === "string"
        ? patch.composePrompt
        : current.composePrompt,
    contentEnabled:
      typeof patch.contentEnabled === "boolean"
        ? patch.contentEnabled
        : current.contentEnabled,
    contentSpreadEnabled:
      typeof patch.contentSpreadEnabled === "boolean"
        ? patch.contentSpreadEnabled
        : current.contentSpreadEnabled,
    contentNewsEnabled:
      typeof patch.contentNewsEnabled === "boolean"
        ? patch.contentNewsEnabled
        : current.contentNewsEnabled,
    contentMinSpreadPct:
      typeof patch.contentMinSpreadPct === "number"
        ? clampPct(patch.contentMinSpreadPct)
        : current.contentMinSpreadPct,
    contentMinOffers:
      typeof patch.contentMinOffers === "number"
        ? clampInt(patch.contentMinOffers, 2, 50, current.contentMinOffers)
        : current.contentMinOffers,
    contentMaxSpreadPerRun:
      typeof patch.contentMaxSpreadPerRun === "number"
        ? clampInt(
            patch.contentMaxSpreadPerRun,
            1,
            20,
            current.contentMaxSpreadPerRun,
          )
        : current.contentMaxSpreadPerRun,
    contentSpreadCooldownHours:
      typeof patch.contentSpreadCooldownHours === "number"
        ? clampInt(
            patch.contentSpreadCooldownHours,
            1,
            168,
            current.contentSpreadCooldownHours,
          )
        : current.contentSpreadCooldownHours,
    contentAutoPublish:
      typeof patch.contentAutoPublish === "boolean"
        ? patch.contentAutoPublish
        : current.contentAutoPublish,
    contentMaxPostsPerDay:
      typeof patch.contentMaxPostsPerDay === "number"
        ? clampInt(
            patch.contentMaxPostsPerDay,
            1,
            48,
            current.contentMaxPostsPerDay,
          )
        : current.contentMaxPostsPerDay,
    contentMinIntervalMinutes:
      typeof patch.contentMinIntervalMinutes === "number"
        ? clampInt(
            patch.contentMinIntervalMinutes,
            0,
            720,
            current.contentMinIntervalMinutes,
          )
        : current.contentMinIntervalMinutes,
    contentQuietStartHour:
      typeof patch.contentQuietStartHour === "number"
        ? clampInt(patch.contentQuietStartHour, 0, 23, current.contentQuietStartHour)
        : current.contentQuietStartHour,
    contentQuietEndHour:
      typeof patch.contentQuietEndHour === "number"
        ? clampInt(patch.contentQuietEndHour, 0, 23, current.contentQuietEndHour)
        : current.contentQuietEndHour,
    contentIntervalMinutes:
      typeof patch.contentIntervalMinutes === "number"
        ? clampInt(
            patch.contentIntervalMinutes,
            5,
            180,
            current.contentIntervalMinutes,
          )
        : current.contentIntervalMinutes,
    contentMaxNewsPerRun:
      typeof patch.contentMaxNewsPerRun === "number"
        ? clampInt(
            patch.contentMaxNewsPerRun,
            1,
            20,
            current.contentMaxNewsPerRun,
          )
        : current.contentMaxNewsPerRun,
    contentNewsLookbackHours:
      typeof patch.contentNewsLookbackHours === "number"
        ? clampInt(
            patch.contentNewsLookbackHours,
            1,
            336,
            current.contentNewsLookbackHours,
          )
        : current.contentNewsLookbackHours,
    contentIncludeCash:
      typeof patch.contentIncludeCash === "boolean"
        ? patch.contentIncludeCash
        : current.contentIncludeCash,
    contentPairAllowlist: clampStr(
      patch.contentPairAllowlist,
      4000,
      current.contentPairAllowlist,
    ),
    contentPairBlocklist: clampStr(
      patch.contentPairBlocklist,
      4000,
      current.contentPairBlocklist,
    ),
    contentFooter: clampStr(patch.contentFooter, 2000, current.contentFooter),
    contentSpreadButtonText:
      typeof patch.contentSpreadButtonText === "string"
        ? patch.contentSpreadButtonText.trim().slice(0, 64) ||
          current.contentSpreadButtonText
        : current.contentSpreadButtonText,
    contentNewsButtonText:
      typeof patch.contentNewsButtonText === "string"
        ? patch.contentNewsButtonText.trim().slice(0, 64) ||
          current.contentNewsButtonText
        : current.contentNewsButtonText,
    contentUtmCampaign:
      typeof patch.contentUtmCampaign === "string"
        ? patch.contentUtmCampaign.trim().slice(0, 64) || "content"
        : current.contentUtmCampaign,
    contentWithNewsImage:
      typeof patch.contentWithNewsImage === "boolean"
        ? patch.contentWithNewsImage
        : current.contentWithNewsImage,
    contentPostSilent:
      typeof patch.contentPostSilent === "boolean"
        ? patch.contentPostSilent
        : current.contentPostSilent,
    contentDisablePreview:
      typeof patch.contentDisablePreview === "boolean"
        ? patch.contentDisablePreview
        : current.contentDisablePreview,
    contentLastRunAt: current.contentLastRunAt,
    contentLastRunResult: current.contentLastRunResult,
    updatedAt: now,
  };

  const db = getDb();
  await db
    .update(telegramSettings)
    .set(next)
    .where(eq(telegramSettings.id, 1));

  return toPublic(next);
}

export async function listTelegramPosts(limit = 50): Promise<TelegramPost[]> {
  await ensureSettingsRow();
  try {
    const { reclaimStaleTelegramComposeJobs } = await import(
      "@/lib/telegram/compose-draft-job"
    );
    await reclaimStaleTelegramComposeJobs();
  } catch (err) {
    console.warn("[gapsnap] reclaim telegram compose jobs failed", err);
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(telegramPosts)
    .orderBy(desc(telegramPosts.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(mapPost);
}

export async function getTelegramAdminSnapshot(): Promise<{
  settings: TelegramSettingsPublic;
  posts: TelegramPost[];
  contentJobs: import("@/lib/telegram/content/types").TelegramContentJob[];
  env: { hasBotToken: boolean; hasChannelId: boolean };
  defaultComposePrompt: string;
  composePlaceholders: string[];
  models: Array<{ id: string; ownedBy?: string }>;
  modelsError: string | null;
  newsModel: string;
  siteUrl: string;
  siteName: string;
}> {
  const { DEFAULT_TELEGRAM_COMPOSE_PROMPT } = await import(
    "@/lib/telegram/default-prompt"
  );
  const { getNewsSettings, getSeoSettings } = await import("@/lib/store");
  const { codexConfigured, listCodexModels } = await import(
    "@/lib/ai/codex-client"
  );
  const { listTelegramContentJobs } = await import(
    "@/lib/telegram/content/engine"
  );

  const [settings, posts, contentJobs, news, seo] = await Promise.all([
    getTelegramSettingsPublic(),
    listTelegramPosts(50),
    listTelegramContentJobs(40).catch(() => []),
    getNewsSettings().catch(() => null),
    getSeoSettings().catch(() => null),
  ]);

  let models: Array<{ id: string; ownedBy?: string }> = [];
  let modelsError: string | null = null;
  if (codexConfigured()) {
    try {
      models = await listCodexModels();
    } catch (error) {
      modelsError = error instanceof Error ? error.message : "models failed";
    }
  } else {
    modelsError = "CODEX_API_KEY не задан";
  }

  const publicSettings: TelegramSettingsPublic = {
    ...settings,
    composePrompt:
      settings.composePrompt.trim() || DEFAULT_TELEGRAM_COMPOSE_PROMPT,
    composeModel: settings.composeModel.trim() || news?.model?.trim() || "",
  };

  return {
    settings: publicSettings,
    posts,
    contentJobs,
    env: {
      hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      hasChannelId: Boolean(process.env.TELEGRAM_CHANNEL_ID?.trim()),
    },
    defaultComposePrompt: DEFAULT_TELEGRAM_COMPOSE_PROMPT,
    composePlaceholders: ["{{topic}}", "{{siteName}}", "{{siteUrl}}"],
    models,
    modelsError,
    newsModel: news?.model?.trim() || "",
    siteUrl: (seo?.siteUrl ?? process.env.SITE_URL ?? "https://gapsnap.org")
      .trim()
      .replace(/\/+$/, ""),
    siteName: seo?.siteName?.trim() || "GapSnap",
  };
}

export async function startTelegramComposeDraft(input: {
  topic: string;
  withImage?: boolean;
  model?: string;
  adminLogin?: string;
}): Promise<TelegramPost> {
  const topic = input.topic.trim();
  if (!topic) throw new Error("Укажите тему или описание обновления");

  await ensureSettingsRow();
  const settings = await getTelegramSettings();
  const { getNewsSettings } = await import("@/lib/store");
  const news = await getNewsSettings().catch(() => null);
  const model =
    (input.model ?? "").trim() ||
    settings.composeModel.trim() ||
    news?.model?.trim() ||
    "";
  if (!model) {
    throw new Error("Выберите модель ИИ в настройках Telegram или Новостей");
  }

  const now = new Date().toISOString();
  const id = newPostId();
  const withImage = input.withImage !== false;
  const db = getDb();
  await db.insert(telegramPosts).values({
    id,
    createdAt: now,
    updatedAt: now,
    chatId: settings.channelId || "",
    messageId: null,
    text: "",
    parseMode: settings.parseMode || "HTML",
    disablePreview: settings.disablePreview,
    silent: settings.silent,
    photoUrl: "",
    buttons: [],
    topic,
    progress: "В очереди…",
    withImage,
    status: "generating",
    error: null,
    adminLogin: (input.adminLogin ?? "").trim(),
  });

  const { ensureTelegramComposeRunner } = await import(
    "@/lib/telegram/compose-draft-job"
  );
  ensureTelegramComposeRunner(id);

  const [row] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, id))
    .limit(1);
  return mapPost(row!);
}

export async function discardTelegramDraft(id: string): Promise<TelegramPost> {
  await ensureSettingsRow();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, id))
    .limit(1);
  if (!row) throw new Error("Черновик не найден");
  if (row.status !== "draft" && row.status !== "failed" && row.status !== "generating") {
    throw new Error("Можно удалить только черновик / ошибку / незавершённую генерацию");
  }
  const now = new Date().toISOString();
  await db
    .update(telegramPosts)
    .set({ status: "deleted", updatedAt: now, progress: "Удалён", error: null })
    .where(eq(telegramPosts.id, id));
  const [updated] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, id))
    .limit(1);
  return mapPost(updated!);
}

export async function startTelegramImageFromPostText(input: {
  text: string;
  topic?: string;
}): Promise<{ jobId: string }> {
  const { getSeoSettings } = await import("@/lib/store");
  const seo = await getSeoSettings();
  const text = input.text.trim();
  if (!text) throw new Error("Нет текста поста для картинки");

  const { startTelegramImageJob } = await import(
    "@/lib/telegram/compose-image-job"
  );
  const started = startTelegramImageJob({
    postText: text,
    topic: input.topic,
    siteName: seo.siteName || "GapSnap",
  });
  return { jobId: started.jobId };
}

export async function getTelegramImageJobStatus(jobId: string) {
  const { getTelegramImageJob } = await import(
    "@/lib/telegram/compose-image-job"
  );
  const job = getTelegramImageJob(jobId);
  if (!job) throw new Error("Задача генерации картинки не найдена");
  return {
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      percent: job.percent,
      photoUrl: job.photoUrl,
      error: job.error,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      elapsedMs: Date.now() - job.startedAt,
    },
  };
}

/** @deprecated Prefer startTelegramImageFromPostText + polling (Cloudflare ~100s limit). */
export async function generateTelegramImageFromPostText(input: {
  text: string;
  topic?: string;
  model?: string;
}): Promise<{ photoUrl: string }> {
  const { getSeoSettings } = await import("@/lib/store");
  const seo = await getSeoSettings();
  const text = input.text.trim();
  if (!text) throw new Error("Нет текста поста для картинки");

  const { composeTelegramPostImage } = await import(
    "@/lib/telegram/compose-image"
  );
  const image = await composeTelegramPostImage({
    postText: text,
    topic: input.topic,
    siteName: seo.siteName || "GapSnap",
    textModel: input.model,
  });
  return { photoUrl: image.photoUrl };
}

export async function testTelegramConnection(): Promise<TelegramConnectionInfo> {
  const settings = await getTelegramSettings();
  if (!settings.botToken.trim()) {
    return {
      ok: false,
      botUsername: "",
      botId: null,
      channelId: settings.channelId,
      channelTitle: "",
      channelType: "",
      error: "Укажите bot token",
    };
  }
  if (!settings.channelId.trim()) {
    return {
      ok: false,
      botUsername: "",
      botId: null,
      channelId: "",
      channelTitle: "",
      channelType: "",
      error: "Укажите ID или @username канала",
    };
  }

  try {
    const me = await tgGetMe(settings.botToken);
    const chat = await tgGetChat(settings.botToken, settings.channelId);
    const botUsername = me.username ? `@${me.username}` : me.first_name;
    const channelTitle = chat.title || chat.username || String(chat.id);

    await updateTelegramSettings({
      botUsername,
      channelTitle,
    });

    return {
      ok: true,
      botUsername,
      botId: me.id,
      channelId: String(chat.id),
      channelTitle,
      channelType: chat.type,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      botUsername: settings.botUsername,
      botId: null,
      channelId: settings.channelId,
      channelTitle: settings.channelTitle,
      channelType: "",
      error: error instanceof Error ? error.message : "Ошибка Telegram API",
    };
  }
}

function newPostId(): string {
  return `tg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function publishTelegramPost(input: {
  text: string;
  photoUrl?: string;
  parseMode?: TelegramParseMode;
  disablePreview?: boolean;
  silent?: boolean;
  buttons?: TelegramButtonRow[];
  adminLogin?: string;
  /** If set, publish this draft/failed row instead of creating a new journal entry. */
  draftId?: string;
}): Promise<TelegramPost> {
  const settings = await getTelegramSettings();
  const text = input.text.trim();
  const photoUrl = (input.photoUrl ?? "").trim();
  if (!text && !photoUrl) {
    throw new Error("Введите текст или URL картинки");
  }
  if (!settings.botToken.trim()) {
    throw new Error("Bot token не задан");
  }
  if (!settings.channelId.trim()) {
    throw new Error("Канал не задан");
  }

  const draftId = (input.draftId ?? "").trim();
  let draftTopic = "";
  let draftWithImage = false;
  if (draftId) {
    await ensureSettingsRow();
    const db = getDb();
    const [draft] = await db
      .select()
      .from(telegramPosts)
      .where(eq(telegramPosts.id, draftId))
      .limit(1);
    if (!draft) throw new Error("Черновик не найден");
    if (draft.status !== "draft" && draft.status !== "failed") {
      throw new Error("Публиковать можно только черновик");
    }
    draftTopic = draft.topic ?? "";
    draftWithImage = Boolean(draft.withImage);
  }

  const parseMode = normalizeParseMode(input.parseMode ?? settings.parseMode);
  const disablePreview =
    typeof input.disablePreview === "boolean"
      ? input.disablePreview
      : settings.disablePreview;
  const silent =
    typeof input.silent === "boolean" ? input.silent : settings.silent;
  const buttons = normalizeTelegramButtons(input.buttons ?? []);
  const replyMarkup = telegramReplyMarkup(buttons);
  const now = new Date().toISOString();
  const id = draftId || newPostId();
  const adminLogin = (input.adminLogin ?? "").trim();

  try {
    const { isLocalTgImageUrl, readTgImageFile, tgImageFilenameFromUrl } =
      await import("@/lib/telegram/tg-image");

    let photoBytes: Buffer | undefined;
    let photoFilename: string | undefined;
    if (photoUrl && isLocalTgImageUrl(photoUrl)) {
      const name = tgImageFilenameFromUrl(photoUrl);
      if (name) {
        const file = await readTgImageFile(name);
        if (file) {
          photoBytes = file.bytes;
          photoFilename = name;
        }
      }
    }

    const absolutePhotoUrl =
      photoUrl && !photoBytes
        ? /^https?:\/\//i.test(photoUrl)
          ? photoUrl
          : `${(process.env.SITE_URL ?? "https://gapsnap.org").replace(/\/+$/, "")}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`
        : photoUrl;

    const msg = photoUrl
      ? await tgSendPhoto(settings.botToken, {
          chatId: settings.channelId,
          photoUrl: absolutePhotoUrl,
          photoBytes,
          photoFilename,
          caption: text || undefined,
          parseMode: text ? parseMode : undefined,
          silent,
          replyMarkup,
        })
      : await tgSendMessage(settings.botToken, {
          chatId: settings.channelId,
          text,
          parseMode,
          disablePreview,
          silent,
          replyMarkup,
        });

    const db = getDb();
    if (draftId) {
      await db
        .update(telegramPosts)
        .set({
          updatedAt: now,
          chatId: String(msg.chat.id),
          messageId: msg.message_id,
          text,
          parseMode,
          disablePreview,
          silent,
          photoUrl,
          buttons,
          topic: draftTopic,
          withImage: draftWithImage,
          progress: "Опубликовано",
          status: "sent",
          error: null,
          adminLogin: adminLogin || "",
        })
        .where(eq(telegramPosts.id, draftId));
    } else {
      await db.insert(telegramPosts).values({
        id,
        createdAt: now,
        updatedAt: now,
        chatId: String(msg.chat.id),
        messageId: msg.message_id,
        text,
        parseMode,
        disablePreview,
        silent,
        photoUrl,
        buttons,
        topic: "",
        progress: "",
        withImage: Boolean(photoUrl),
        status: "sent",
        error: null,
        adminLogin,
      });
    }
    await updateTelegramSettings({ lastPostAt: now });
    const [row] = await db
      .select()
      .from(telegramPosts)
      .where(eq(telegramPosts.id, id))
      .limit(1);
    return mapPost(row!);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ошибка отправки в Telegram";
    const db = getDb();
    if (draftId) {
      await db
        .update(telegramPosts)
        .set({
          updatedAt: now,
          text,
          parseMode,
          disablePreview,
          silent,
          photoUrl,
          buttons,
          status: "failed",
          progress: "Ошибка публикации",
          error: message,
          adminLogin: adminLogin || "",
        })
        .where(eq(telegramPosts.id, draftId));
      const [row] = await db
        .select()
        .from(telegramPosts)
        .where(eq(telegramPosts.id, draftId))
        .limit(1);
      throw Object.assign(new Error(message), { post: mapPost(row!) });
    }
    await db.insert(telegramPosts).values({
      id,
      createdAt: now,
      updatedAt: now,
      chatId: settings.channelId,
      messageId: null,
      text,
      parseMode,
      disablePreview,
      silent,
      photoUrl,
      buttons,
      topic: "",
      progress: "",
      withImage: Boolean(photoUrl),
      status: "failed",
      error: message,
      adminLogin,
    });
    const [row] = await db
      .select()
      .from(telegramPosts)
      .where(eq(telegramPosts.id, id))
      .limit(1);
    throw Object.assign(new Error(message), { post: mapPost(row!) });
  }
}

export async function editTelegramPost(input: {
  id: string;
  text: string;
  parseMode?: TelegramParseMode;
  disablePreview?: boolean;
  buttons?: TelegramButtonRow[];
}): Promise<TelegramPost> {
  const text = input.text.trim();
  if (!text) throw new Error("Текст не может быть пустым");

  await ensureSettingsRow();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, input.id))
    .limit(1);
  if (!row) throw new Error("Пост не найден");
  if (row.status === "deleted") throw new Error("Пост уже удалён");
  if (!row.messageId) throw new Error("Нет message_id для правки");

  const settings = await getTelegramSettings();
  if (!settings.botToken.trim()) throw new Error("Bot token не задан");

  const parseMode = normalizeParseMode(input.parseMode ?? row.parseMode);
  const disablePreview =
    typeof input.disablePreview === "boolean"
      ? input.disablePreview
      : Boolean(row.disablePreview);
  const buttons =
    input.buttons !== undefined
      ? normalizeTelegramButtons(input.buttons)
      : normalizeTelegramButtons(row.buttons ?? []);
  const replyMarkup = telegramReplyMarkupOrClear(buttons);

  if (row.photoUrl) {
    await tgEditMessageCaption(settings.botToken, {
      chatId: row.chatId,
      messageId: row.messageId,
      caption: text,
      parseMode,
      replyMarkup,
    });
  } else {
    await tgEditMessageText(settings.botToken, {
      chatId: row.chatId,
      messageId: row.messageId,
      text,
      parseMode,
      disablePreview,
      replyMarkup,
    });
  }

  const now = new Date().toISOString();
  await db
    .update(telegramPosts)
    .set({
      text,
      parseMode,
      disablePreview,
      buttons,
      updatedAt: now,
      error: null,
      status: "sent",
    })
    .where(eq(telegramPosts.id, input.id));

  const [updated] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, input.id))
    .limit(1);
  return mapPost(updated!);
}

export async function deleteTelegramPost(id: string): Promise<TelegramPost> {
  await ensureSettingsRow();
  const db = getDb();
  const [row] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, id))
    .limit(1);
  if (!row) throw new Error("Пост не найден");
  if (row.status === "deleted") return mapPost(row);

  const settings = await getTelegramSettings();
  if (row.messageId && settings.botToken.trim() && row.chatId) {
    try {
      await tgDeleteMessage(settings.botToken, row.chatId, row.messageId);
    } catch (error) {
      // Message may already be gone — still mark deleted locally.
      const msg = error instanceof Error ? error.message : "";
      if (!/message to delete not found|message can't be deleted/i.test(msg)) {
        throw error;
      }
    }
  }

  const now = new Date().toISOString();
  await db
    .update(telegramPosts)
    .set({ status: "deleted", updatedAt: now, error: null })
    .where(eq(telegramPosts.id, id));

  const [updated] = await db
    .select()
    .from(telegramPosts)
    .where(eq(telegramPosts.id, id))
    .limit(1);
  return mapPost(updated!);
}
