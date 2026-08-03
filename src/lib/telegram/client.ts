import "server-only";

import dns from "node:dns";
import type { TelegramParseMode } from "@/lib/telegram/types";

/** Node may prefer broken IPv6 routes; Telegram works reliably over IPv4 here. */
dns.setDefaultResultOrder("ipv4first");

const API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 15_000;

export type TelegramApiError = {
  ok: false;
  error_code?: number;
  description?: string;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  date: number;
};

type OkResult<T> = { ok: true; result: T };

async function callTelegram<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Bot token не задан");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/bot${trimmed}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Telegram API не ответил за ${REQUEST_TIMEOUT_MS / 1000}с. ` +
          `С этой сети валидные bot-запросы часто блокируются ` +
          `(неверный токен отвечает сразу 401). Нужен выход в Telegram ` +
          `через VPN/прокси или другой хостинг.`,
      );
    }
    throw new Error(
      error instanceof Error
        ? `Сеть Telegram: ${error.message}`
        : "Сеть Telegram недоступна",
    );
  } finally {
    clearTimeout(timer);
  }

  let data: OkResult<T> | TelegramApiError;
  try {
    data = (await res.json()) as OkResult<T> | TelegramApiError;
  } catch {
    throw new Error(`Telegram API вернул не-JSON (HTTP ${res.status})`);
  }

  if (!data.ok) {
    const err = data as TelegramApiError;
    throw new Error(
      err.description?.trim() ||
        `Telegram API error ${err.error_code ?? res.status}`,
    );
  }
  return (data as OkResult<T>).result;
}

export async function tgGetMe(token: string): Promise<TelegramUser> {
  return callTelegram<TelegramUser>(token, "getMe");
}

export async function tgGetChat(
  token: string,
  chatId: string,
): Promise<TelegramChat> {
  return callTelegram<TelegramChat>(token, "getChat", { chat_id: chatId });
}

export async function tgSendMessage(
  token: string,
  input: {
    chatId: string;
    text: string;
    parseMode?: TelegramParseMode;
    disablePreview?: boolean;
    silent?: boolean;
    replyMarkup?: Record<string, unknown>;
  },
): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>(token, "sendMessage", {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: input.parseMode || undefined,
    disable_web_page_preview: input.disablePreview ?? false,
    disable_notification: input.silent ?? false,
    reply_markup: input.replyMarkup || undefined,
  });
}

export async function tgSendPhoto(
  token: string,
  input: {
    chatId: string;
    photoUrl: string;
    caption?: string;
    parseMode?: TelegramParseMode;
    silent?: boolean;
    replyMarkup?: Record<string, unknown>;
  },
): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>(token, "sendPhoto", {
    chat_id: input.chatId,
    photo: input.photoUrl,
    caption: input.caption || undefined,
    parse_mode: input.parseMode || undefined,
    disable_notification: input.silent ?? false,
    reply_markup: input.replyMarkup || undefined,
  });
}

export async function tgEditMessageText(
  token: string,
  input: {
    chatId: string;
    messageId: number;
    text: string;
    parseMode?: TelegramParseMode;
    disablePreview?: boolean;
    replyMarkup?: Record<string, unknown>;
  },
): Promise<TelegramMessage | true> {
  return callTelegram<TelegramMessage | true>(token, "editMessageText", {
    chat_id: input.chatId,
    message_id: input.messageId,
    text: input.text,
    parse_mode: input.parseMode || undefined,
    disable_web_page_preview: input.disablePreview ?? false,
    reply_markup: input.replyMarkup,
  });
}

export async function tgEditMessageCaption(
  token: string,
  input: {
    chatId: string;
    messageId: number;
    caption: string;
    parseMode?: TelegramParseMode;
    replyMarkup?: Record<string, unknown>;
  },
): Promise<TelegramMessage | true> {
  return callTelegram<TelegramMessage | true>(token, "editMessageCaption", {
    chat_id: input.chatId,
    message_id: input.messageId,
    caption: input.caption,
    parse_mode: input.parseMode || undefined,
    reply_markup: input.replyMarkup,
  });
}

export async function tgDeleteMessage(
  token: string,
  chatId: string,
  messageId: number,
): Promise<boolean> {
  return callTelegram<boolean>(token, "deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

export function maskBotToken(token: string): string {
  const t = token.trim();
  if (!t) return "";
  if (t.length <= 12) return "••••••••";
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}
