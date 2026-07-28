import type { BannerCheckJson } from "@/db/schema";

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

export type BannerCheck = BannerCheckJson;

export type FeedExchanger = {
  id: string;
  slug: string;
  name: string;
  website: string;
  /** Deep-link with `{0}`=from, `{1}`=to. Empty → use website. */
  exchangeUrlTemplate: string;
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
  /** Opaque token for partner-site badge detection. */
  bannerToken: string | null;
  bannerCheck: BannerCheck;
  /** Логин кабинета владельца (задаётся при заявке) */
  ownerLogin: string | null;
  /** SHA-256 / scrypt хеш пароля владельца */
  ownerPasswordHash: string | null;
  /** Email владельца для писем (одобрение, 2FA) */
  ownerEmail: string | null;
  /** TOTP secret (base32), если 2FA включена */
  ownerTotpSecret: string | null;
  ownerTotpEnabled: boolean;
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
  /** Linked exchanger id when picked from catalog; null for free-text entries */
  exchangerId: string | null;
};

export type ReviewSentiment = "positive" | "negative";
export type ReviewStatus =
  | "awaiting_email"
  | "pending"
  | "approved"
  | "rejected";

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
  /** Ответ владельца обменника */
  ownerReply: string | null;
  ownerRepliedAt: string | null;
  /** Email автора (для подтверждения); не отдаём публично */
  email: string | null;
  emailVerifiedAt: string | null;
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

export type AdTariffPeriod = "day" | "week" | "month";

/** Публичный тариф на размещение — правится в админке */
export type AdTariff = {
  id: string;
  placement: AdPlacement;
  type: AdType;
  title: string;
  description: string;
  /** Напр. 1200×90 или «текстовая строка» */
  sizeLabel: string;
  price: number;
  period: AdTariffPeriod;
  currency: "RUB";
  features: string[];
  active: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type AdPricingSettings = {
  contact: string;
  intro: string;
  note: string;
};

/** Глобальные SEO-настройки сайта (админка → /trulala/seo) */
export type SeoSettings = {
  siteName: string;
  /** Базовый URL сайта без слэша в конце, напр. https://gapsnap.example */
  siteUrl: string;
  titleDefault: string;
  /** Шаблон заголовка страниц, напр. %s · GapSnap */
  titleTemplate: string;
  description: string;
  /** Ключевые слова через запятую */
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterCard: "summary" | "summary_large_image";
  twitterHandle: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  /** Доп. директивы robots meta через запятую */
  robotsExtra: string;
  /** Доп. строки для /robots.txt */
  robotsTxtExtra: string;
  sitemapEnabled: boolean;
  /** Пути Disallow в robots.txt, по одному на строку */
  noindexPaths: string;
  googleVerification: string;
  yandexVerification: string;
  bingVerification: string;
  jsonLdEnabled: boolean;
  organizationName: string;
  organizationLogoUrl: string;
  /** GA4 measurement id, e.g. G-XXXX */
  googleAnalyticsId: string;
  /** Yandex.Metrika counter id */
  yandexMetricaId: string;
  /** Google Tag Manager id, e.g. GTM-XXXX */
  gtmId: string;
};

export type BlogPostStatus = "draft" | "published";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  tags: string[];
  status: BlogPostStatus;
  seoTitle: string;
  seoDescription: string;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

