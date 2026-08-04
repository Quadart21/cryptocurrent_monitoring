import "server-only";

import dns from "node:dns";
import type { TelegramMessage, TelegramUser } from "@/lib/telegram/client";

dns.setDefaultResultOrder("ipv4first");

const API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 15_000;

type OkResult<T> = { ok: true; result: T };
type TelegramApiError = {
  ok: false;
  error_code?: number;
  description?: string;
};

async function callTelegram<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error("Bot token не задан");

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
        `Telegram API не ответил за ${REQUEST_TIMEOUT_MS / 1000}с`,
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

export async function scoutTgGetMe(token: string): Promise<TelegramUser> {
  return callTelegram<TelegramUser>(token, "getMe");
}

export async function scoutTgSendMessage(
  token: string,
  chatId: number | string,
  text: string,
): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export async function scoutTgSetWebhook(
  token: string,
  input: { url: string; secretToken: string },
): Promise<boolean> {
  return callTelegram<boolean>(token, "setWebhook", {
    url: input.url,
    secret_token: input.secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}

export async function scoutTgDeleteWebhook(token: string): Promise<boolean> {
  return callTelegram<boolean>(token, "deleteWebhook", {
    drop_pending_updates: false,
  });
}

export async function scoutTgGetWebhookInfo(token: string): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}> {
  return callTelegram(token, "getWebhookInfo");
}
