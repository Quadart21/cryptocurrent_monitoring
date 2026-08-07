export type TelegramContentJobKind = "spread" | "news";

export type TelegramContentJobStatus =
  | "queued"
  | "drafted"
  | "published"
  | "skipped"
  | "failed"
  | "discarded";

export type TelegramContentJob = {
  id: string;
  createdAt: string;
  updatedAt: string;
  kind: TelegramContentJobKind;
  dedupeKey: string;
  status: TelegramContentJobStatus;
  title: string;
  payload: Record<string, unknown>;
  postId: string | null;
  error: string | null;
};

export type TelegramContentSettings = {
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
  contentLastRunAt: string | null;
  contentLastRunResult: string;
};

export type TelegramContentRunResult = {
  ok: boolean;
  enabled: boolean;
  spreadEnqueued: number;
  newsEnqueued: number;
  drafted: number;
  published: number;
  failed: number;
  skipped: number;
  message: string;
  ranAt: string;
};

export type SpreadPayload = {
  from: string;
  to: string;
  bestRate: number;
  worstRate: number;
  offerCount: number;
  spreadPct: number;
  pairPath: string;
};

export type NewsPayload = {
  blogId: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string;
  blogPath: string;
};
