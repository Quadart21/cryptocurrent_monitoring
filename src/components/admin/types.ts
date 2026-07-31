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
  pendingComplaints: number;
  pendingCatalog: number;
  achievements: number;
  ads: number;
  bannerMissing: number;
};

export type AdminExchanger = Omit<FeedExchanger, "ownerPasswordHash"> & {
  hasOwnerPassword?: boolean;
};

export type AdminOverview = {
  me?: AdminMe;
  lastGlobalSyncAt: string | null;
  counts: AdminCounts;
  exchangers: AdminExchanger[];
  blacklist: BlacklistItem[];
  reviews: ReviewRow[];
  qualityTags: ReviewQualityTag[];
  achievements: ExchangerAchievement[];
  ads: AdCreative[];
};

export type AdminMe = {
  id: string;
  login: string;
  role: string;
  active: boolean;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  displayName: string;
  permissions: string[];
};

export type AdminNavId =
  | "overview"
  | "exchangers"
  | "reviews"
  | "complaints"
  | "qualities"
  | "achievements"
  | "ads"
  | "ad-tariffs"
  | "seo"
  | "branding"
  | "legal"
  | "email"
  | "blog"
  | "blacklist"
  | "catalog"
  | "sync"
  | "banners"
  | "admins";

export type AdminNavGroupId =
  | "main"
  | "moderation"
  | "content"
  | "ads"
  | "site"
  | "data";

export type AdminNavBadge =
  | "pending"
  | "pendingReviews"
  | "pendingComplaints"
  | "pendingCatalog"
  | "bannerMissing"
  | "syncQueue";

export type AdminNavItem = {
  id: AdminNavId;
  href: string;
  label: string;
  description: string;
  group: AdminNavGroupId;
  badge?: AdminNavBadge;
  /** Read permission required to see this nav item */
  permission?: string;
};

export type AdminNavGroup = {
  id: AdminNavGroupId;
  label: string;
};
