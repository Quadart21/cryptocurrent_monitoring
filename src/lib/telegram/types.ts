export type TelegramParseMode = "HTML" | "MarkdownV2" | "Markdown";

export type TelegramSettings = {
  botToken: string;
  channelId: string;
  parseMode: TelegramParseMode;
  disablePreview: boolean;
  silent: boolean;
  botUsername: string;
  channelTitle: string;
  lastPostAt: string | null;
  composeModel: string;
  composePrompt: string;
  updatedAt: string;
};

/** Settings returned to the admin UI (token never echoed in full). */
export type TelegramSettingsPublic = Omit<TelegramSettings, "botToken"> & {
  hasBotToken: boolean;
  botTokenHint: string;
};

export type TelegramPostStatus = "sent" | "failed" | "deleted";

export type TelegramPost = {
  id: string;
  createdAt: string;
  updatedAt: string;
  chatId: string;
  messageId: number | null;
  text: string;
  parseMode: TelegramParseMode;
  disablePreview: boolean;
  silent: boolean;
  photoUrl: string;
  status: TelegramPostStatus;
  error: string | null;
  adminLogin: string;
};

export type TelegramConnectionInfo = {
  ok: boolean;
  botUsername: string;
  botId: number | null;
  channelId: string;
  channelTitle: string;
  channelType: string;
  error: string | null;
};
