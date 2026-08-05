import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export type ExchangerTrafficJson = {
  pageViews: number;
  siteClicks: number;
  lastViewAt: string | null;
  lastClickAt: string | null;
  daily: Array<{ date: string; pageViews: number; siteClicks: number }>;
};

/** Result of daily GapSnap badge placement check on exchanger website. */
export type BannerCheckJson = {
  status: "pending" | "ok" | "missing" | "error";
  lastCheckAt: string | null;
  lastSeenAt: string | null;
  missingSince: string | null;
  consecutiveMisses: number;
  lastError: string | null;
  /** Last admin alert email about missing banner. */
  lastNotifiedAt: string | null;
  /** Last warning email sent to exchanger owner. */
  lastOwnerWarnedAt: string | null;
  ownerWarnCount: number;
};

export type AdStatsJson = {
  impressions: number;
  clicks: number;
  lastImpressionAt: string | null;
  lastClickAt: string | null;
  daily: Array<{ date: string; impressions: number; clicks: number }>;
};

export const exchangers = pgTable(
  "exchangers",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    website: text("website").notNull().default(""),
    /** Deep-link template: `{0}` = from code, `{1}` = to code. */
    exchangeUrlTemplate: text("exchange_url_template").notNull().default(""),
    /**
     * GapSnap-owned affiliate / referral link (admin or apply).
     * Plain URL or template with `{0}`/`{1}`. Overrides public outbound when set.
     */
    referralUrlTemplate: text("referral_url_template").notNull().default(""),
    feedUrl: text("feed_url").notNull().default(""),
    contact: text("contact").notNull().default(""),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("pending"),
    verified: boolean("verified").notNull().default(false),
    rating: doublePrecision("rating").notNull().default(0),
    reviews: integer("reviews").notNull().default(0),
    reviewsPositive: integer("reviews_positive").notNull().default(0),
    reviewsNegative: integer("reviews_negative").notNull().default(0),
    ageYears: integer("age_years").notNull().default(1),
    createdAt: text("created_at").notNull(),
    approvedAt: text("approved_at"),
    lastSyncAt: text("last_sync_at"),
    lastError: text("last_error"),
    pairCount: integer("pair_count").notNull().default(0),
    achievementIds: text("achievement_ids").array().notNull().default([]),
    logoFormat: text("logo_format"),
    logoUpdatedAt: text("logo_updated_at"),
    logoData: bytea("logo_data"),
    traffic: jsonb("traffic").$type<ExchangerTrafficJson>().notNull(),
    /** Opaque token for GapSnap badge detection on partner sites. */
    bannerToken: text("banner_token"),
    bannerCheck: jsonb("banner_check").$type<BannerCheckJson>(),
    ownerLogin: text("owner_login"),
    ownerPasswordHash: text("owner_password_hash"),
    ownerEmail: text("owner_email"),
    ownerTotpSecret: text("owner_totp_secret"),
    ownerTotpEnabled: boolean("owner_totp_enabled").notNull().default(false),
    /** When GapSnap invite/intro email was last sent to the exchanger. */
    inviteEmailSentAt: text("invite_email_sent_at"),
    /** Address the invite email was sent to (audit). */
    inviteEmailTo: text("invite_email_to").notNull().default(""),
    /** Stable numeric ID for BestChange-compatible public API (`changers` / rates). */
    apiId: integer("api_id"),
  },
  (t) => [
    index("exchangers_status_idx").on(t.status),
    index("exchangers_owner_login_idx").on(t.ownerLogin),
    uniqueIndex("exchangers_api_id_uidx").on(t.apiId),
  ],
);

export const rates = pgTable(
  "rates",
  {
    id: text("id").primaryKey(),
    exchangerId: text("exchanger_id")
      .notNull()
      .references(() => exchangers.id, { onDelete: "cascade" }),
    from: text("from").notNull(),
    to: text("to").notNull(),
    inAmount: doublePrecision("in_amount").notNull(),
    outAmount: doublePrecision("out_amount").notNull(),
    rate: doublePrecision("rate").notNull(),
    reserve: doublePrecision("reserve").notNull().default(0),
    minAmount: doublePrecision("min_amount").notNull().default(0),
    maxAmount: doublePrecision("max_amount").notNull().default(0),
    city: text("city"),
    param: text("param"),
    tofee: text("tofee"),
    syncedAt: text("synced_at").notNull(),
  },
  (t) => [
    index("rates_exchanger_id_idx").on(t.exchangerId),
    index("rates_from_to_idx").on(t.from, t.to),
  ],
);

export const blacklist = pgTable("blacklist", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  reason: text("reason").notNull(),
  reportedAt: text("reported_at").notNull(),
  reports: integer("reports").notNull().default(1),
  exchangerId: text("exchanger_id"),
});

export const qualityTags = pgTable("quality_tags", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    exchangerId: text("exchanger_id")
      .notNull()
      .references(() => exchangers.id, { onDelete: "cascade" }),
    exchangerSlug: text("exchanger_slug").notNull(),
    exchangerName: text("exchanger_name").notNull(),
    sentiment: text("sentiment").notNull(),
    orderId: text("order_id").notNull(),
    text: text("text").notNull(),
    qualityTagIds: text("quality_tag_ids").array().notNull().default([]),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
    moderatedAt: text("moderated_at"),
    ownerReply: text("owner_reply"),
    ownerRepliedAt: text("owner_replied_at"),
    /** Admin closed the discussion — no further replies. */
    threadClosed: boolean("thread_closed").notNull().default(false),
    email: text("email"),
    emailVerifiedAt: text("email_verified_at"),
    confirmTokenHash: text("confirm_token_hash"),
    confirmExpiresAt: text("confirm_expires_at"),
  },
  (t) => [
    index("reviews_exchanger_id_idx").on(t.exchangerId),
    index("reviews_status_idx").on(t.status),
    index("reviews_confirm_token_hash_idx").on(t.confirmTokenHash),
  ],
);

export type ReviewReplyRole = "owner" | "reviewer" | "admin";

export const reviewReplies = pgTable(
  "review_replies",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    authorRole: text("author_role").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("review_replies_review_id_idx").on(t.reviewId)],
);

/** Magic-link tokens for review authors to continue a thread. */
export const reviewReplyTokens = pgTable(
  "review_reply_tokens",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    email: text("email").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("review_reply_tokens_hash_idx").on(t.tokenHash),
    index("review_reply_tokens_review_id_idx").on(t.reviewId),
  ],
);

export type ComplaintStatus =
  | "awaiting_email"
  | "pending"
  | "in_progress"
  | "resolved_blacklist"
  | "rejected";

export const complaints = pgTable(
  "complaints",
  {
    id: text("id").primaryKey(),
    exchangerId: text("exchanger_id")
      .notNull()
      .references(() => exchangers.id, { onDelete: "cascade" }),
    exchangerSlug: text("exchanger_slug").notNull(),
    exchangerName: text("exchanger_name").notNull(),
    email: text("email").notNull(),
    body: text("body").notNull(),
    orderId: text("order_id").notNull().default(""),
    relatedReviewId: text("related_review_id"),
    status: text("status").notNull().default("awaiting_email"),
    adminNote: text("admin_note").notNull().default(""),
    createdAt: text("created_at").notNull(),
    moderatedAt: text("moderated_at"),
    emailVerifiedAt: text("email_verified_at"),
    confirmTokenHash: text("confirm_token_hash"),
    confirmExpiresAt: text("confirm_expires_at"),
  },
  (t) => [
    index("complaints_exchanger_id_idx").on(t.exchangerId),
    index("complaints_status_idx").on(t.status),
    index("complaints_confirm_token_hash_idx").on(t.confirmTokenHash),
  ],
);

/** Auto-assignment rule stored on an achievement (mode=auto). */
export type AchievementRuleJson = {
  kind:
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
  minRating?: number;
  minReviews?: number;
  minAgeYears?: number;
  minPairs?: number;
  maxSyncAgeHours?: number;
  maxAgeDays?: number;
  minPositiveRatio?: number;
  minReserveSum?: number;
};

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  svg: text("svg").notNull(),
  /** manual = admin toggle; auto = system assigns from rule */
  mode: text("mode").notNull().default("manual"),
  rule: jsonb("rule").$type<AchievementRuleJson | null>(),
  createdAt: text("created_at").notNull(),
});

export const ads = pgTable("ads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  placement: text("placement").notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  href: text("href").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  /** Uploaded banner bytes (JPG/PNG/WebP/…; SVG rasterized); public URL `/api/ad-images/:id`. */
  imageFormat: text("image_format"),
  imageUpdatedAt: text("image_updated_at"),
  imageData: bytea("image_data"),
  exchangerId: text("exchanger_id"),
  /**
   * Pair scope for rates_pin / highlight: empty = everywhere.
   * Keys are `FROM:TO` (uppercase currency codes).
   */
  pairs: text("pairs").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  createdAt: text("created_at").notNull(),
  stats: jsonb("stats").$type<AdStatsJson>().notNull(),
});

export const adTariffs = pgTable("ad_tariffs", {
  id: text("id").primaryKey(),
  placement: text("placement").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  sizeLabel: text("size_label").notNull().default(""),
  price: doublePrecision("price").notNull().default(0),
  period: text("period").notNull().default("week"),
  currency: text("currency").notNull().default("RUB"),
  features: text("features").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const adPricing = pgTable("ad_pricing", {
  id: integer("id").primaryKey().default(1),
  contact: text("contact").notNull(),
  intro: text("intro").notNull(),
  note: text("note").notNull(),
});

/** Privacy / cookie / terms policies + consent banner copy (admin-editable). */
export const legal = pgTable("legal", {
  id: integer("id").primaryKey().default(1),
  privacyTitle: text("privacy_title").notNull(),
  privacyBody: text("privacy_body").notNull(),
  privacyUpdatedAt: text("privacy_updated_at").notNull(),
  cookieTitle: text("cookie_title").notNull(),
  cookieBody: text("cookie_body").notNull(),
  cookieUpdatedAt: text("cookie_updated_at").notNull(),
  termsTitle: text("terms_title").notNull().default("Условия использования"),
  termsBody: text("terms_body").notNull().default(""),
  termsUpdatedAt: text("terms_updated_at").notNull().default(""),
  bannerTitle: text("banner_title").notNull(),
  bannerBody: text("banner_body").notNull(),
});

export const seo = pgTable("seo", {
  id: integer("id").primaryKey().default(1),
  siteName: text("site_name").notNull(),
  siteUrl: text("site_url").notNull().default(""),
  titleDefault: text("title_default").notNull(),
  titleTemplate: text("title_template").notNull(),
  description: text("description").notNull(),
  keywords: text("keywords").notNull().default(""),
  ogTitle: text("og_title").notNull(),
  ogDescription: text("og_description").notNull(),
  ogImageUrl: text("og_image_url").notNull().default(""),
  twitterCard: text("twitter_card").notNull(),
  twitterHandle: text("twitter_handle").notNull().default(""),
  robotsIndex: boolean("robots_index").notNull().default(true),
  robotsFollow: boolean("robots_follow").notNull().default(true),
  robotsExtra: text("robots_extra").notNull().default(""),
  robotsTxtExtra: text("robots_txt_extra").notNull().default(""),
  sitemapEnabled: boolean("sitemap_enabled").notNull().default(true),
  noindexPaths: text("noindex_paths").notNull().default(""),
  googleVerification: text("google_verification").notNull().default(""),
  yandexVerification: text("yandex_verification").notNull().default(""),
  bingVerification: text("bing_verification").notNull().default(""),
  jsonLdEnabled: boolean("json_ld_enabled").notNull().default(true),
  organizationName: text("organization_name").notNull(),
  organizationLogoUrl: text("organization_logo_url").notNull().default(""),
  /** Публичный email сайта (футер, партнёры, schema.org) */
  contactEmail: text("contact_email").notNull().default(""),
  /** Telegram: @handle или https://t.me/... */
  contactTelegram: text("contact_telegram").notNull().default(""),
  googleAnalyticsId: text("google_analytics_id").notNull().default(""),
  yandexMetricaId: text("yandex_metrica_id").notNull().default(""),
  gtmId: text("gtm_id").notNull().default(""),
});

/** Public blog / SEO content (also AI-rewritten news). */
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    coverImageUrl: text("cover_image_url").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    status: text("status").notNull().default("draft"),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    authorName: text("author_name").notNull().default(""),
    sourceProvider: text("source_provider").notNull().default(""),
    sourceId: text("source_id"),
    sourceUrl: text("source_url").notNull().default(""),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("blog_posts_status_idx").on(t.status),
    index("blog_posts_published_at_idx").on(t.publishedAt),
    uniqueIndex("blog_posts_source_id_uidx").on(t.sourceId),
  ],
);

/** AI news import settings (single row id=1). */
export const newsSettings = pgTable("news_settings", {
  id: integer("id").primaryKey().default(1),
  model: text("model").notNull().default(""),
  rewritePrompt: text("rewrite_prompt").notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  lastSyncAt: text("last_sync_at"),
  lastSyncResult: text("last_sync_result").notNull().default(""),
  proxyEnabled: boolean("proxy_enabled").notNull().default(true),
  proxyUser: text("proxy_user").notNull().default(""),
  proxyPass: text("proxy_pass").notNull().default(""),
  proxyPort: integer("proxy_port").notNull().default(7165),
  proxyHosts: text("proxy_hosts").notNull().default(""),
  /** Live sync status for admin polling (survives across requests). */
  syncProgress: text("sync_progress").notNull().default(""),
  syncStartedAt: text("sync_started_at"),
  updatedAt: text("updated_at").notNull().default(""),
});

export const appMeta = pgTable("app_meta", {
  id: integer("id").primaryKey().default(1),
  lastGlobalSyncAt: text("last_global_sync_at"),
  seededAt: timestamp("seeded_at", { withTimezone: true }),
  /** Master switch for public /v2 API, docs, and key applications. */
  apiEnabled: boolean("api_enabled").notNull().default(true),
});

/** Runtime email settings (from/name can override env). */
export const emailSettings = pgTable("email_settings", {
  id: integer("id").primaryKey().default(1),
  fromEmail: text("from_email").notNull().default(""),
  fromName: text("from_name").notNull().default("GapSnap"),
  replyTo: text("reply_to").notNull().default(""),
  notifyReviewConfirm: boolean("notify_review_confirm").notNull().default(true),
  notifyOwnerExchangerApproved: boolean("notify_owner_exchanger_approved")
    .notNull()
    .default(true),
  notifyOwnerReviewApproved: boolean("notify_owner_review_approved")
    .notNull()
    .default(true),
  notifyReviewThreadAuthor: boolean("notify_review_thread_author")
    .notNull()
    .default(true),
  notifyReviewThreadOwner: boolean("notify_review_thread_owner")
    .notNull()
    .default(true),
  notifyComplaintConfirm: boolean("notify_complaint_confirm")
    .notNull()
    .default(true),
  notifyApiKeyApproved: boolean("notify_api_key_approved")
    .notNull()
    .default(true),
  notifyExchangerInvite: boolean("notify_exchanger_invite")
    .notNull()
    .default(true),
  updatedAt: text("updated_at").notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const emailLog = pgTable(
  "email_log",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    tag: text("tag").notNull().default(""),
    templateId: text("template_id"),
    status: text("status").notNull().default("sent"),
    error: text("error"),
    providerRaw: text("provider_raw"),
  },
  (t) => [
    index("email_log_created_at_idx").on(t.createdAt),
    index("email_log_tag_idx").on(t.tag),
    index("email_log_status_idx").on(t.status),
  ],
);

/** Aggregated mailing list: exchanger owners + review authors. */
export const emailContacts = pgTable(
  "email_contacts",
  {
    email: text("email").primaryKey(),
    sources: text("sources").array().notNull().default([]),
    label: text("label").notNull().default(""),
    exchangerIds: text("exchanger_ids").array().notNull().default([]),
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("email_contacts_unsubscribed_idx").on(t.unsubscribed),
  ],
);

/** Admin mailbox conversation with a contact email. */
export const mailThreads = pgTable(
  "mail_threads",
  {
    id: text("id").primaryKey(),
    contactEmail: text("contact_email").notNull(),
    contactName: text("contact_name").notNull().default(""),
    subject: text("subject").notNull().default(""),
    lastMessageAt: text("last_message_at").notNull(),
    unreadCount: integer("unread_count").notNull().default(0),
    exchangerId: text("exchanger_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("mail_threads_contact_idx").on(t.contactEmail),
    index("mail_threads_last_msg_idx").on(t.lastMessageAt),
  ],
);

/** Messages inside an admin mailbox thread (inbound from Resend or outbound replies). */
export const mailMessages = pgTable(
  "mail_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    direction: text("direction").notNull(), // inbound | outbound
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull().default(""),
    textBody: text("text_body").notNull().default(""),
    htmlBody: text("html_body").notNull().default(""),
    resendEmailId: text("resend_email_id"),
    messageIdHeader: text("message_id_header"),
    inReplyTo: text("in_reply_to"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("mail_messages_thread_idx").on(t.threadId),
    index("mail_messages_resend_idx").on(t.resendEmailId),
    index("mail_messages_created_idx").on(t.createdAt),
  ],
);

/**
 * New currency/city/country codes awaiting admin moderation.
 * Live catalog is NOT updated until status = approved.
 */
export const catalogProposals = pgTable(
  "catalog_proposals",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(), // currency | city | country
    code: text("code").notNull(),
    name: text("name").notNull().default(""),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    discoveredAt: text("discovered_at").notNull(),
    moderatedAt: text("moderated_at"),
  },
  (t) => [
    index("catalog_proposals_status_idx").on(t.status),
    index("catalog_proposals_kind_code_idx").on(t.kind, t.code),
  ],
);

/** Live currency catalogs — editable in admin, source of truth in DB. */
export const bcGroups = pgTable("bc_groups", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
});

export const bcCountries = pgTable("bc_countries", {
  code: text("code").primaryKey(),
  id: integer("id").notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  rank: integer("rank").notNull().default(9999),
});

export const bcCities = pgTable(
  "bc_cities",
  {
    code: text("code").primaryKey(),
    id: integer("id").notNull(),
    name: text("name").notNull(),
    nameEn: text("name_en").notNull().default(""),
    countryId: integer("country_id"),
    countryCode: text("country_code").notNull().default(""),
    countryName: text("country_name").notNull().default(""),
    rank: integer("rank").notNull().default(9999),
  },
  (t) => [index("bc_cities_country_code_idx").on(t.countryCode)],
);

export const bcCurrencies = pgTable(
  "bc_currencies",
  {
    code: text("code").primaryKey(),
    id: integer("id").notNull(),
    name: text("name").notNull(),
    nameEn: text("name_en").notNull().default(""),
    viewname: text("viewname").notNull().default(""),
    urlname: text("urlname").notNull().default(""),
    crypto: boolean("crypto").notNull().default(false),
    cash: boolean("cash").notNull().default(false),
    groupId: integer("group_id").notNull().default(0),
    ps: integer("ps").notNull().default(0),
    defamt: doublePrecision("defamt").notNull().default(0),
    bigamt: doublePrecision("bigamt").notNull().default(0),
    rank: integer("rank").notNull().default(9999),
  },
  (t) => [
    index("bc_currencies_cash_idx").on(t.cash),
    index("bc_currencies_group_id_idx").on(t.groupId),
  ],
);

export const bcCatalogMeta = pgTable("bc_catalog_meta", {
  id: integer("id").primaryKey().default(1),
  fetchedAt: text("fetched_at"),
  updatedAt: text("updated_at").notNull(),
  source: text("source").notNull().default("db"),
});

export const adminUsers = pgTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    login: text("login").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("viewer"),
    active: boolean("active").notNull().default(true),
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    displayName: text("display_name").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastLoginAt: text("last_login_at"),
  },
  (t) => [
    uniqueIndex("admin_users_login_uidx").on(t.login),
    index("admin_users_role_idx").on(t.role),
  ],
);

export const exchangerTrafficEvents = pgTable(
  "exchanger_traffic_events",
  {
    id: text("id").primaryKey(),
    exchangerId: text("exchanger_id")
      .notNull()
      .references(() => exchangers.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    ip: text("ip").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    path: text("path").notNull().default(""),
    referrer: text("referrer").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("exchanger_traffic_events_exchanger_created_idx").on(
      t.exchangerId,
      t.createdAt,
    ),
    index("exchanger_traffic_events_created_idx").on(t.createdAt),
    index("exchanger_traffic_events_event_idx").on(t.event),
  ],
);

/** Site branding binaries (logo, favicons, OG) — one row per kind. */
export const siteAssets = pgTable("site_assets", {
  kind: text("kind").primaryKey(),
  format: text("format").notNull(),
  updatedAt: text("updated_at").notNull(),
  data: bytea("data").notNull(),
});

export type ApiClientStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revoked";

/** External API access applications and issued keys (BestChange-style). */
export const apiClients = pgTable(
  "api_clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    website: text("website").notNull().default(""),
    purpose: text("purpose").notNull().default(""),
    status: text("status").notNull().default("pending"),
    keyPrefix: text("key_prefix"),
    keyHash: text("key_hash"),
    rateLimitPerSec: integer("rate_limit_per_sec").notNull().default(10),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull(),
    moderatedAt: text("moderated_at"),
    adminNote: text("admin_note").notNull().default(""),
  },
  (t) => [
    index("api_clients_status_idx").on(t.status),
    index("api_clients_email_idx").on(t.email),
    uniqueIndex("api_clients_key_hash_uidx").on(t.keyHash),
  ],
);

/** Telegram channel bot settings (single row id=1). */
export const telegramSettings = pgTable("telegram_settings", {
  id: integer("id").primaryKey().default(1),
  botToken: text("bot_token").notNull().default(""),
  channelId: text("channel_id").notNull().default(""),
  parseMode: text("parse_mode").notNull().default("HTML"),
  disablePreview: boolean("disable_preview").notNull().default(false),
  silent: boolean("silent").notNull().default(false),
  botUsername: text("bot_username").notNull().default(""),
  channelTitle: text("channel_title").notNull().default(""),
  lastPostAt: text("last_post_at"),
  composeModel: text("compose_model").notNull().default(""),
  composePrompt: text("compose_prompt").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

/** Outbound Telegram channel posts (admin compose log). */
export const telegramPosts = pgTable(
  "telegram_posts",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    chatId: text("chat_id").notNull().default(""),
    messageId: integer("message_id"),
    text: text("text").notNull().default(""),
    parseMode: text("parse_mode").notNull().default("HTML"),
    disablePreview: boolean("disable_preview").notNull().default(false),
    silent: boolean("silent").notNull().default(false),
    photoUrl: text("photo_url").notNull().default(""),
    buttons: jsonb("buttons")
      .$type<Array<Array<{ text: string; url: string }>>>()
      .notNull()
      .default([]),
    status: text("status").notNull().default("sent"),
    error: text("error"),
    adminLogin: text("admin_login").notNull().default(""),
  },
  (t) => [
    index("telegram_posts_created_at_idx").on(t.createdAt),
    index("telegram_posts_status_idx").on(t.status),
  ],
);

/** Feed-scout Telegram bot settings (single row id=1). */
export const feedScoutSettings = pgTable("feed_scout_settings", {
  id: integer("id").primaryKey().default(1),
  botToken: text("bot_token").notNull().default(""),
  botUsername: text("bot_username").notNull().default(""),
  xrocketPayKey: text("xrocket_pay_key").notNull().default(""),
  payoutAmount: doublePrecision("payout_amount").notNull().default(1),
  payoutCurrency: text("payout_currency").notNull().default("USDT"),
  enabled: boolean("enabled").notNull().default(true),
  webhookSecret: text("webhook_secret").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

/** Workers who submit XML feed URLs via the scout bot. */
export const feedScoutWorkers = pgTable(
  "feed_scout_workers",
  {
    id: text("id").primaryKey(),
    tgUserId: text("tg_user_id").notNull(),
    username: text("username").notNull().default(""),
    firstName: text("first_name").notNull().default(""),
    status: text("status").notNull().default("active"),
    /**
     * Max accepted links for this worker (lifetime until raised).
     * null = unlimited; 0 = cannot submit until admin grants quota.
     */
    linkQuota: integer("link_quota"),
    /** Free-form admin note (who is this scout, contacts, etc.). */
    adminNote: text("admin_note").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("feed_scout_workers_tg_uidx").on(t.tgUserId),
    index("feed_scout_workers_status_idx").on(t.status),
  ],
);

/** Accepted (or attempted) feed submissions + payout ledger. */
export const feedScoutSubmissions = pgTable(
  "feed_scout_submissions",
  {
    id: text("id").primaryKey(),
    workerId: text("worker_id")
      .notNull()
      .references(() => feedScoutWorkers.id, { onDelete: "cascade" }),
    feedUrl: text("feed_url").notNull(),
    feedUrlNorm: text("feed_url_norm").notNull(),
    exchangerId: text("exchanger_id"),
    pairCount: integer("pair_count").notNull().default(0),
    amount: doublePrecision("amount").notNull().default(0),
    currency: text("currency").notNull().default("USDT"),
    payoutStatus: text("payout_status").notNull().default("none"),
    xrocketTransferId: text("xrocket_transfer_id"),
    payoutError: text("payout_error"),
    createdAt: text("created_at").notNull(),
    paidAt: text("paid_at"),
  },
  (t) => [
    uniqueIndex("feed_scout_submissions_norm_uidx").on(t.feedUrlNorm),
    index("feed_scout_submissions_worker_idx").on(t.workerId),
    index("feed_scout_submissions_created_idx").on(t.createdAt),
    index("feed_scout_submissions_payout_idx").on(t.payoutStatus),
  ],
);

