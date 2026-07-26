export type FeedExchangerStatus = "pending" | "active" | "rejected" | "error";

export type FeedExchanger = {
  id: string;
  slug: string;
  name: string;
  website: string;
  feedUrl: string;
  contact: string;
  description: string;
  status: FeedExchangerStatus;
  verified: boolean;
  rating: number;
  reviews: number;
  ageYears: number;
  createdAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  pairCount: number;
};

export type BlacklistItem = {
  id: string;
  name: string;
  reason: string;
  reportedAt: string;
  reports: number;
};
