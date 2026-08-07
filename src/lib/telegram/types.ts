export type TelegramParseMode = "HTML" | "MarkdownV2" | "Markdown";

/** URL inline button (callback buttons need a webhook — not used in channels). */
export type TelegramUrlButton = {
  text: string;
  url: string;
};

/** One keyboard row of URL buttons. */
export type TelegramButtonRow = TelegramUrlButton[];

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
  contentEnabled: boolean;
  contentSpreadEnabled: boolean;
  contentNewsEnabled: boolean;
  contentMinSpreadPct: number;
  contentMinOffers: number;
  contentMaxSpreadPerRun: number;
  contentSpreadCooldownHours: number;
  contentAutoPublish: boolean;
  contentMaxPostsPerDay: number;
  contentMinIntervalMinutes: number;
  contentQuietStartHour: number;
  contentQuietEndHour: number;
  contentIntervalMinutes: number;
  contentMaxNewsPerRun: number;
  contentNewsLookbackHours: number;
  contentIncludeCash: boolean;
  contentPairAllowlist: string;
  contentPairBlocklist: string;
  contentFooter: string;
  contentSpreadButtonText: string;
  contentNewsButtonText: string;
  contentUtmCampaign: string;
  contentWithNewsImage: boolean;
  contentPostSilent: boolean;
  contentDisablePreview: boolean;
  contentLastRunAt: string | null;
  contentLastRunResult: string;
  updatedAt: string;
};

/** Settings returned to the admin UI (token never echoed in full). */
export type TelegramSettingsPublic = Omit<TelegramSettings, "botToken"> & {
  hasBotToken: boolean;
  botTokenHint: string;
};

export type TelegramPostStatus =
  | "generating"
  | "draft"
  | "sent"
  | "failed"
  | "deleted";

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
  buttons: TelegramButtonRow[];
  topic: string;
  progress: string;
  withImage: boolean;
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
