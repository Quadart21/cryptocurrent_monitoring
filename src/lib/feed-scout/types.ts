export type FeedScoutWorkerStatus = "active" | "banned";

export type FeedScoutPayoutStatus = "paid" | "failed" | "none";

export type FeedScoutSettings = {
  botToken: string;
  botUsername: string;
  xrocketPayKey: string;
  payoutAmount: number;
  payoutCurrency: string;
  enabled: boolean;
  webhookSecret: string;
  updatedAt: string;
};

export type FeedScoutSettingsPublic = {
  botUsername: string;
  payoutAmount: number;
  payoutCurrency: string;
  enabled: boolean;
  updatedAt: string;
  hasBotToken: boolean;
  botTokenHint: string;
  hasXrocketPayKey: boolean;
  xrocketPayKeyHint: string;
  hasWebhookSecret: boolean;
};

export type FeedScoutWorker = {
  id: string;
  tgUserId: string;
  username: string;
  firstName: string;
  status: FeedScoutWorkerStatus;
  createdAt: string;
  updatedAt: string;
  acceptedCount: number;
  paidTotal: number;
  failedPayouts: number;
};

export type FeedScoutSubmission = {
  id: string;
  workerId: string;
  workerTgUserId: string;
  workerUsername: string;
  feedUrl: string;
  feedUrlNorm: string;
  exchangerId: string | null;
  pairCount: number;
  amount: number;
  currency: string;
  payoutStatus: FeedScoutPayoutStatus;
  xrocketTransferId: string | null;
  payoutError: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type FeedScoutUrlResult =
  | {
      url: string;
      ok: true;
      exchangerId: string;
      pairCount: number;
      amount: number;
      currency: string;
      payoutStatus: FeedScoutPayoutStatus;
      payoutError?: string;
    }
  | {
      url: string;
      ok: false;
      reason: string;
    };
