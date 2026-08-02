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
  /** Numeric ID for BestChange-compatible public API. */
  apiId: number | null;
};

export type AchievementMode = "manual" | "auto";

export type AchievementRuleKind =
  | "verified"
  | "rating_min"
  | "reviews_min"
  | "age_years_min"
  | "pair_count_min"
  | "not_blacklisted"
  | "sync_fresh"
  | "newcomer"
  | "positive_ratio_min"
  | "reserve_sum_min";

export type AchievementRule = {
  kind: AchievementRuleKind;
  minRating?: number;
  minReviews?: number;
  minAgeYears?: number;
  minPairs?: number;
  maxSyncAgeHours?: number;
  maxAgeDays?: number;
  minPositiveRatio?: number;
  minReserveSum?: number;
};

export type ExchangerAchievement = {
  id: string;
  name: string;
  description: string;
  /** Raw SVG markup (icon). */
  svg: string;
  mode: AchievementMode;
  rule: AchievementRule | null;
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
  /** Legacy / mirror of last owner reply in thread */
  ownerReply: string | null;
  ownerRepliedAt: string | null;
  /** Admin closed discussion — no further replies */
  threadClosed: boolean;
  /** Email автора (для подтверждения); не отдаём публично */
  email: string | null;
  emailVerifiedAt: string | null;
};

export type ReviewReplyRole = "owner" | "reviewer" | "admin";

export type ReviewReply = {
  id: string;
  reviewId: string;
  authorRole: ReviewReplyRole;
  body: string;
  createdAt: string;
};

export type ComplaintStatus =
  | "awaiting_email"
  | "pending"
  | "in_progress"
  | "resolved_blacklist"
  | "rejected";

export type Complaint = {
  id: string;
  exchangerId: string;
  exchangerSlug: string;
  exchangerName: string;
  email: string;
  body: string;
  orderId: string;
  relatedReviewId: string | null;
  status: ComplaintStatus;
  adminNote: string;
  createdAt: string;
  moderatedAt: string | null;
  emailVerifiedAt: string | null;
};

/** Виды рекламы */
export type AdType = "banner" | "ticker" | "highlight" | "rates_pin";

/**
 * Слоты:
 * - header: полоса под топбаром (весь сайт)
 * - ticker: бегущая строка под топбаром
 * - dashboard: баннер над таблицей курсов
 * - home_mid: баннер на главной между курсами и новостями
 * - pair_after: баннер на странице пары после таблицы курсов
 * - exchanger_page: баннер на карточке обменника
 * - footer: баннер внизу контента
 * - exchangers: подсветка в списке обменников
 * - rates: закрепление в таблице курсов
 */
export type AdPlacement =
  | "header"
  | "ticker"
  | "dashboard"
  | "home_mid"
  | "pair_after"
  | "exchanger_page"
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
  /** Картинка баннера: внешний URL или `/api/ad-images/:id` после загрузки */
  imageUrl: string;
  /** Метаданные загруженного файла (если медиа лежит в БД) */
  image: {
    format: "jpeg" | "png" | "webp" | "gif" | "avif" | "mp4" | "webm";
    updatedAt: string;
  } | null;
  /** Для highlight / rates_pin */
  exchangerId: string | null;
  /**
   * Область для rates_pin: пусто = везде, иначе только эти пары (`FROM:TO`).
   * Для highlight обычно пусто (глобальный список /exchangers).
   */
  pairs: string[];
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

/** Политики конфиденциальности, cookies и условия использования (админка → Правовые) */
export type LegalSettings = {
  privacyTitle: string;
  /** Markdown */
  privacyBody: string;
  privacyUpdatedAt: string;
  cookieTitle: string;
  /** Markdown */
  cookieBody: string;
  cookieUpdatedAt: string;
  termsTitle: string;
  /** Markdown */
  termsBody: string;
  termsUpdatedAt: string;
  /** Текст плашки согласия */
  bannerTitle: string;
  bannerBody: string;
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
  /** Публичный email (футер, партнёры, schema.org) */
  contactEmail: string;
  /** Telegram: @handle или https://t.me/... */
  contactTelegram: string;
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
  sourceProvider: string;
  sourceId: string | null;
  sourceUrl: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsSyncResultSummary = {
  fetched: number;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
  syncedAt: string;
};

export type NewsSettings = {
  model: string;
  rewritePrompt: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncResult: NewsSyncResultSummary | null;
  proxyEnabled: boolean;
  proxyUser: string;
  proxyPass: string;
  proxyPort: number;
  /** Raw multiline / comma-separated IP list from admin. */
  proxyHosts: string;
  /** Parsed unique IPv4 hosts. */
  proxyHostList: string[];
  syncProgress: string;
  syncStartedAt: string | null;
  updatedAt: string;
};

