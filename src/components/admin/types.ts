import type {
  AdCreative,
  BlacklistItem,
  ExchangerAchievement,
  ExchangerReview,
  FeedExchanger,
  ReviewQualityTag,
} from "@/lib/store-types";

export type ReviewRow = ExchangerReview & { qualityLabels: string[] };

export type AdminCounts = {
  exchangers: number;
  active: number;
  pending: number;
  error: number;
  rates: number;
  blacklist: number;
  pendingReviews: number;
  achievements: number;
  ads: number;
};

export type AdminOverview = {
  lastGlobalSyncAt: string | null;
  counts: AdminCounts;
  exchangers: FeedExchanger[];
  blacklist: BlacklistItem[];
  reviews: ReviewRow[];
  qualityTags: ReviewQualityTag[];
  achievements: ExchangerAchievement[];
  ads: AdCreative[];
};

export type AdminNavId =
  | "overview"
  | "exchangers"
  | "reviews"
  | "qualities"
  | "achievements"
  | "ads"
  | "blacklist"
  | "sync";

export type AdminNavItem = {
  id: AdminNavId;
  href: string;
  label: string;
  description: string;
};
