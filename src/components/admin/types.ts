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
  pendingCatalog: number;
  achievements: number;
  ads: number;
  bannerMissing: number;
};

export type AdminExchanger = Omit<FeedExchanger, "ownerPasswordHash"> & {
  hasOwnerPassword?: boolean;
};

export type AdminOverview = {
  lastGlobalSyncAt: string | null;
  counts: AdminCounts;
  exchangers: AdminExchanger[];
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
  | "ad-tariffs"
  | "seo"
  | "legal"
  | "email"
  | "blog"
  | "blacklist"
  | "catalog"
  | "sync";

export type AdminNavItem = {
  id: AdminNavId;
  href: string;
  label: string;
  description: string;
};
