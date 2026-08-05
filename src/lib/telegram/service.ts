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
    updatedAt: row?.updatedAt ?? "",
  };
}

function toPublic(settings: TelegramSettings): TelegramSettingsPublic {
  const token = settings.botToken.trim();
  return {
    channelId: settings.channelId,
    parseMode: settings.parseMode,
    disablePreview: settings.disablePreview,
    silent: settings.silent,
    botUsername: settings.botUsername,
    channelTitle: settings.channelTitle,
    lastPostAt: settings.lastPostAt,
    composeModel: settings.composeModel,
    composePrompt: settings.composePrompt,
    updatedAt: settings.updatedAt,
    hasBotToken: Boolean(token),
    botTokenHint: maskBotToken(token),
  };
}

function mapPost(row: typeof telegramPosts.$inferSelect): TelegramPost {
  const status = (row.status || "sent") as TelegramPostStatus;
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
    status:
      status === "failed" || status === "deleted" || status === "sent"
        ? status
        : "sent",
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
}): Promise<TelegramSettingsPublic> {
  await ensureSettingsRow();
  const current = await getTelegramSettings();
  const now = new Date().toISOString();

  const nextToken =
    typeof patch.botToken === "string" && patch.botToken.trim()
      ? patch.botToken.trim()
      : current.botToken;

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

  const [settings, posts, news, seo] = await Promise.all([
    getTelegramSettingsPublic(),
    listTelegramPosts(50),
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

export async function generateTelegramPostFromTopic(input: {
  topic: string;
  model?: string;
  /** Generate cover image from the composed text (default true). */
  withImage?: boolean;
}): Promise<{
  text: string;
  parseMode: TelegramParseMode;
  photoUrl: string;
  imageError: string | null;
}> {
  const { composeTelegramPost } = await import("@/lib/telegram/compose-post");
  const { DEFAULT_TELEGRAM_COMPOSE_PROMPT } = await import(
    "@/lib/telegram/default-prompt"
  );
  const { getNewsSettings, getSeoSettings } = await import("@/lib/store");

  const [settings, news, seo] = await Promise.all([
    getTelegramSettings(),
    getNewsSettings().catch(() => null),
    getSeoSettings(),
  ]);

  const model =
    (input.model ?? "").trim() ||
    settings.composeModel.trim() ||
    news?.model?.trim() ||
    "";
  if (!model) {
    throw new Error("Выберите модель ИИ в настройках Telegram или Новостей");
  }

  const prompt =
    settings.composePrompt.trim() || DEFAULT_TELEGRAM_COMPOSE_PROMPT;
  const siteName = seo.siteName || "GapSnap";
  const siteUrl = seo.siteUrl || process.env.SITE_URL || "https://gapsnap.org";

  const composed = await composeTelegramPost({
    model,
    promptTemplate: prompt,
    topic: input.topic,
    siteName,
    siteUrl,
  });

  const withImage = input.withImage !== false;
  if (!withImage) {
    return { ...composed, photoUrl: "", imageError: null };
  }

  try {
    const { composeTelegramPostImage } = await import(
      "@/lib/telegram/compose-image"
    );
    const image = await composeTelegramPostImage({
      postText: composed.text,
      topic: input.topic,
      siteName,
      textModel: model,
    });
    return { ...composed, photoUrl: image.photoUrl, imageError: null };
  } catch (error) {
    const imageError =
      error instanceof Error ? error.message : "Не удалось сгенерировать картинку";
    console.warn(`[gapsnap] telegram compose image failed:`, imageError);
    return { ...composed, photoUrl: "", imageError };
  }
}

export async function generateTelegramImageFromPostText(input: {
  text: string;
  topic?: string;
  model?: string;
}): Promise<{ photoUrl: string }> {
  const { getNewsSettings, getSeoSettings } = await import("@/lib/store");
  const [settings, news, seo] = await Promise.all([
    getTelegramSettings(),
    getNewsSettings().catch(() => null),
    getSeoSettings(),
  ]);

  const model =
    (input.model ?? "").trim() ||
    settings.composeModel.trim() ||
    news?.model?.trim() ||
    "";
  if (!model) {
    throw new Error("Выберите модель ИИ в настройках Telegram или Новостей");
  }

  const text = input.text.trim();
  if (!text) throw new Error("Нет текста поста для картинки");

  const { composeTelegramPostImage } = await import(
    "@/lib/telegram/compose-image"
  );
  const image = await composeTelegramPostImage({
    postText: text,
    topic: input.topic,
    siteName: seo.siteName || "GapSnap",
    textModel: model,
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
  const id = newPostId();
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
      status: "sent",
      error: null,
      adminLogin,
    });
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
