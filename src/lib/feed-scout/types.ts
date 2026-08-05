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
  /** null = unlimited; 0 = blocked until admin raises */
  linkQuota: number | null;
  /** Remaining slots; null when unlimited */
  linksRemaining: number | null;
  /** Remaining slots × payout rate */
  budgetReserved: number;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  acceptedCount: number;
  paidTotal: number;
  failedPayouts: number;
  lastSubmissionAt: string | null;
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

export type FeedScoutEnrichmentSummary = {
  name: string;
  contact: string;
  emails: string[];
  telegrams: string[];
  logoSaved: boolean;
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
      enrichment?: FeedScoutEnrichmentSummary;
    }
  | {
      url: string;
      ok: false;
      reason: string;
    };
