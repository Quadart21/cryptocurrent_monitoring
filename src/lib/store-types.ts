export type FeedExchangerStatus = "pending" | "active" | "rejected" | "error";

export type ExchangerLogo = {
  format: "svg" | "png";
  updatedAt: string;
};

export type ExchangerDailyTraffic = {
  /** YYYY-MM-DD (UTC) */
  date: string;
  pageViews: number;
  siteClicks: number;
};

/** Просмотры страницы обменника и переходы на сайт */
export type ExchangerTraffic = {
  pageViews: number;
  siteClicks: number;
  lastViewAt: string | null;
  lastClickAt: string | null;
  daily: ExchangerDailyTraffic[];
};

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
  /** 0–5 from approved reviews: (positive / total) * 5. 0 if no reviews. */
  rating: number;
  /** Approved reviews count (positive + negative). */
  reviews: number;
  reviewsPositive: number;
  reviewsNegative: number;
  ageYears: number;
  createdAt: string;
  /** Дата первого одобрения в админке — «работает с …» */
  approvedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  pairCount: number;
  /** Admin-assigned achievement IDs shown next to the name. */
  achievementIds: string[];
  /** Optional logo from application (SVG or transparent PNG). */
  logo: ExchangerLogo | null;
  traffic: ExchangerTraffic;
};

export type ExchangerAchievement = {
  id: string;
  name: string;
  description: string;
  /** Raw SVG markup (icon). */
  svg: string;
  createdAt: string;
};

export type BlacklistItem = {
  id: string;
  name: string;
  reason: string;
  reportedAt: string;
  reports: number;
};

export type ReviewSentiment = "positive" | "negative";
export type ReviewStatus = "pending" | "approved" | "rejected";

export type ReviewQualityTag = {
  id: string;
  label: string;
  active: boolean;
  createdAt: string;
};

export type ExchangerReview = {
  id: string;
  exchangerId: string;
  exchangerSlug: string;
  exchangerName: string;
  sentiment: ReviewSentiment;
  orderId: string;
  text: string;
  qualityTagIds: string[];
  status: ReviewStatus;
  createdAt: string;
  moderatedAt: string | null;
};

/** Виды рекламы */
export type AdType = "banner" | "ticker" | "highlight" | "rates_pin";

/**
 * Слоты:
 * - header: полоса под топбаром (весь сайт)
 * - ticker: бегущая строка под топбаром
 * - dashboard: баннер над таблицей курсов
 * - footer: баннер внизу контента
 * - exchangers: подсветка в списке обменников
 * - rates: закрепление в таблице курсов
 */
export type AdPlacement =
  | "header"
  | "ticker"
  | "dashboard"
  | "footer"
  | "exchangers"
  | "rates";

export type AdDailyStat = {
  /** YYYY-MM-DD (UTC) */
  date: string;
  impressions: number;
  clicks: number;
};

export type AdStats = {
  impressions: number;
  clicks: number;
  lastImpressionAt: string | null;
  lastClickAt: string | null;
  /** По дням, обычно до 30 последних */
  daily: AdDailyStat[];
};

export type AdCreative = {
  id: string;
  /** Внутреннее имя в админке */
  name: string;
  type: AdType;
  placement: AdPlacement;
  title: string;
  body: string;
  href: string;
  /** Опциональная картинка (URL) для баннера */
  imageUrl: string;
  /** Для highlight / rates_pin */
  exchangerId: string | null;
  active: boolean;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  stats: AdStats;
};
