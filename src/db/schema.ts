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
    ownerLogin: text("owner_login"),
    ownerPasswordHash: text("owner_password_hash"),
    ownerEmail: text("owner_email"),
    ownerTotpSecret: text("owner_totp_secret"),
    ownerTotpEnabled: boolean("owner_totp_enabled").notNull().default(false),
  },
  (t) => [
    index("exchangers_status_idx").on(t.status),
    index("exchangers_owner_login_idx").on(t.ownerLogin),
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

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  svg: text("svg").notNull(),
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
  exchangerId: text("exchanger_id"),
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
});

export const appMeta = pgTable("app_meta", {
  id: integer("id").primaryKey().default(1),
  lastGlobalSyncAt: text("last_global_sync_at"),
  seededAt: timestamp("seeded_at", { withTimezone: true }),
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
