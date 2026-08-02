import "server-only";

import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import {
  achievements,
  adPricing,
  ads,
  adTariffs,
  appMeta,
  blacklist,
  blogPosts,
  exchangers,
  legal,
  newsSettings,
  qualityTags,
  rates,
  reviews,
  seo,
  siteAssets,
  type AdStatsJson,
  type BannerCheckJson,
  type ExchangerTrafficJson,
} from "@/db/schema";
import { seedAdPricing, seedLegal, seedSeo } from "@/db/seed";
import {
  DEFAULT_PROXY_HOSTS,
  DEFAULT_PROXY_PORT,
  formatProxyHosts,
  parseProxyHosts,
} from "@/lib/ai/default-proxies";
import { emptyAdStats, normalizeAdStats, utcDayKey } from "@/lib/ads";
import { isAdImageFormat } from "@/lib/ad-image-url";
import type { AdImageFormat } from "@/lib/ad-image-url";
import {
  brandingPublicUrl,
  isSiteAssetFormat,
  SITE_ASSET_KINDS,
  type SiteAssetFormat,
  type SiteAssetKind,
  type SiteAssetMeta,
} from "@/lib/branding-url";
import {
  emptyBannerCheck,
  newBannerToken,
  normalizeBannerCheck,
} from "@/lib/banner";
import {
  emptyExchangerTraffic,
  normalizeExchangerTraffic,
} from "@/lib/exchanger-traffic";
import {
  parseAchievementMode,
  parseAchievementRule,
} from "@/lib/achievement-rules";
import type { ParsedRateItem } from "@/lib/xml/parse-rates";
import type {
  AchievementMode,
  AchievementRule,
  AdCreative,
  AdPlacement,
  AdPricingSettings,
  AdTariff,
  AdTariffPeriod,
  AdType,
  BlacklistItem,
  BlogPost,
  BlogPostStatus,
  NewsSettings,
  NewsSyncResultSummary,
  ExchangerAchievement,
  ExchangerLogo,
  ExchangerReview,
  FeedExchanger,
  FeedExchangerStatus,
  LegalSettings,
  ReviewQualityTag,
  ReviewSentiment,
  ReviewStatus,
  SeoSettings,
} from "@/lib/store-types";

export type {
  AdCreative,
  AdPlacement,
  AdPricingSettings,
  AdTariff,
  AdTariffPeriod,
  AdType,
  BlacklistItem,
  BlogPost,
  BlogPostStatus,
  NewsSettings,
  NewsSyncResultSummary,
  ExchangerAchievement,
  ExchangerReview,
  FeedExchanger,
  FeedExchangerStatus,
  ReviewQualityTag,
  ReviewSentiment,
  ReviewStatus,
  SeoSettings,
} from "@/lib/store-types";

export type StoredRate = ParsedRateItem & {
  id: string;
  exchangerId: string;
  syncedAt: string;
};

export type StoreData = {
  exchangers: FeedExchanger[];
  rates: StoredRate[];
  blacklist: BlacklistItem[];
  qualityTags: ReviewQualityTag[];
  reviews: ExchangerReview[];
  achievements: ExchangerAchievement[];
  ads: AdCreative[];
  adTariffs: AdTariff[];
  adPricing: AdPricingSettings;
  seo: SeoSettings;
  lastGlobalSyncAt: string | null;
};

type ExchangerRow = typeof exchangers.$inferSelect;
type RateRow = typeof rates.$inferSelect;
type AdRow = typeof ads.$inferSelect;
type ReviewRow = typeof reviews.$inferSelect;
type AchievementRow = typeof achievements.$inferSelect;
type TariffRow = typeof adTariffs.$inferSelect;
type SeoRow = typeof seo.$inferSelect;
type LegalRow = typeof legal.$inferSelect;

function mapExchanger(row: ExchangerRow): FeedExchanger {
  const logo: ExchangerLogo | null =
    row.logoFormat === "svg" || row.logoFormat === "png"
      ? {
          format: row.logoFormat,
          updatedAt: row.logoUpdatedAt ?? new Date().toISOString(),
        }
      : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    website: row.website,
    exchangeUrlTemplate: row.exchangeUrlTemplate ?? "",
    feedUrl: row.feedUrl,
    contact: row.contact,
    description: row.description,
    status: row.status as FeedExchangerStatus,
    verified: row.verified,
    rating: row.rating,
    reviews: row.reviews,
    reviewsPositive: row.reviewsPositive,
    reviewsNegative: row.reviewsNegative,
    ageYears: row.ageYears,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
    lastSyncAt: row.lastSyncAt,
    lastError: row.lastError,
    pairCount: row.pairCount,
    achievementIds: row.achievementIds ?? [],
    logo,
    traffic: normalizeExchangerTraffic(row.traffic),
    bannerToken: row.bannerToken ?? null,
    bannerCheck: normalizeBannerCheck(row.bannerCheck),
    ownerLogin: row.ownerLogin,
    ownerPasswordHash: row.ownerPasswordHash,
    ownerEmail: row.ownerEmail ?? null,
    ownerTotpSecret: row.ownerTotpSecret ?? null,
    ownerTotpEnabled: Boolean(row.ownerTotpEnabled),
    inviteEmailSentAt: row.inviteEmailSentAt ?? null,
    inviteEmailTo: row.inviteEmailTo ?? "",
    apiId: row.apiId ?? null,
  };
}

function mapRate(row: RateRow): StoredRate {
  return {
    id: row.id,
    exchangerId: row.exchangerId,
    from: row.from,
    to: row.to,
    in: row.inAmount,
    out: row.outAmount,
    rate: row.rate,
    reserve: row.reserve,
    minAmount: row.minAmount,
    maxAmount: row.maxAmount,
    city: row.city ?? undefined,
    param: row.param ?? undefined,
    tofee: row.tofee ?? undefined,
    syncedAt: row.syncedAt,
  };
}

function mapReview(row: ReviewRow): ExchangerReview {
  return {
    id: row.id,
    exchangerId: row.exchangerId,
    exchangerSlug: row.exchangerSlug,
    exchangerName: row.exchangerName,
    sentiment: row.sentiment as ReviewSentiment,
    orderId: row.orderId,
    text: row.text,
    qualityTagIds: row.qualityTagIds ?? [],
    status: row.status as ReviewStatus,
    createdAt: row.createdAt,
    moderatedAt: row.moderatedAt,
    ownerReply: row.ownerReply,
    ownerRepliedAt: row.ownerRepliedAt,
    threadClosed: Boolean(row.threadClosed),
    email: row.email ?? null,
    emailVerifiedAt: row.emailVerifiedAt ?? null,
  };
}

function mapAchievement(row: AchievementRow): ExchangerAchievement {
  const mode = parseAchievementMode(row.mode);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    svg: row.svg,
    mode,
    rule: mode === "auto" ? parseAchievementRule(row.rule) : null,
    createdAt: row.createdAt,
  };
}

function mapAd(row: AdRow): AdCreative {
  const imageFormat = isAdImageFormat(row.imageFormat)
    ? row.imageFormat
    : null;
  const image: AdCreative["image"] =
    imageFormat && row.imageUpdatedAt
      ? { format: imageFormat, updatedAt: row.imageUpdatedAt }
      : null;
  const storedUrl = image
    ? `/api/ad-images/${encodeURIComponent(row.id)}?v=${encodeURIComponent(image.updatedAt)}`
    : null;
  return {
    id: row.id,
    name: row.name,
    type: row.type as AdType,
    placement: row.placement as AdPlacement,
    title: row.title,
    body: row.body,
    href: row.href,
    imageUrl: storedUrl || row.imageUrl,
    image,
    exchangerId: row.exchangerId,
    pairs: Array.isArray(row.pairs) ? row.pairs : [],
    active: row.active,
    priority: row.priority,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    stats: normalizeAdStats(row.stats),
  };
}

function mapTariff(row: TariffRow): AdTariff {
  const period: AdTariffPeriod =
    row.period === "day" || row.period === "week" || row.period === "month"
      ? row.period
      : "week";
  return {
    id: row.id,
    placement: row.placement as AdPlacement,
    type: row.type as AdType,
    title: row.title,
    description: row.description,
    sizeLabel: row.sizeLabel,
    price: row.price,
    period,
    currency: "RUB",
    features: row.features ?? [],
    active: row.active,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  };
}

function mapSeo(row: SeoRow | undefined): SeoSettings {
  if (!row) return structuredClone(seedSeo);
  const twitterCard =
    row.twitterCard === "summary" || row.twitterCard === "summary_large_image"
      ? row.twitterCard
      : seedSeo.twitterCard;
  return {
    siteName: row.siteName || seedSeo.siteName,
    siteUrl: row.siteUrl,
    titleDefault: row.titleDefault || seedSeo.titleDefault,
    titleTemplate: row.titleTemplate || seedSeo.titleTemplate,
    description: row.description || seedSeo.description,
    keywords: row.keywords,
    ogTitle: row.ogTitle || seedSeo.ogTitle,
    ogDescription: row.ogDescription || seedSeo.ogDescription,
    ogImageUrl: row.ogImageUrl,
    twitterCard,
    twitterHandle: row.twitterHandle,
    robotsIndex: row.robotsIndex,
    robotsFollow: row.robotsFollow,
    robotsExtra: row.robotsExtra,
    robotsTxtExtra: row.robotsTxtExtra,
    sitemapEnabled: row.sitemapEnabled,
    noindexPaths: row.noindexPaths || seedSeo.noindexPaths,
    googleVerification: row.googleVerification,
    yandexVerification: row.yandexVerification,
    bingVerification: row.bingVerification,
    jsonLdEnabled: row.jsonLdEnabled,
    organizationName: row.organizationName || seedSeo.organizationName,
    organizationLogoUrl: row.organizationLogoUrl,
    contactEmail: row.contactEmail ?? "",
    contactTelegram: row.contactTelegram ?? "",
    googleAnalyticsId: row.googleAnalyticsId ?? "",
    yandexMetricaId: row.yandexMetricaId ?? "",
    gtmId: row.gtmId ?? "",
  };
}

function normalizeSeoSettings(
  raw: Partial<SeoSettings> | null | undefined,
): SeoSettings {
  const twitterCard =
    raw?.twitterCard === "summary" || raw?.twitterCard === "summary_large_image"
      ? raw.twitterCard
      : seedSeo.twitterCard;
  return {
    siteName:
      typeof raw?.siteName === "string" && raw.siteName.trim()
        ? raw.siteName.trim()
        : seedSeo.siteName,
    siteUrl: typeof raw?.siteUrl === "string" ? raw.siteUrl.trim() : "",
    titleDefault:
      typeof raw?.titleDefault === "string" && raw.titleDefault.trim()
        ? raw.titleDefault.trim()
        : seedSeo.titleDefault,
    titleTemplate:
      typeof raw?.titleTemplate === "string" && raw.titleTemplate.trim()
        ? raw.titleTemplate.trim()
        : seedSeo.titleTemplate,
    description:
      typeof raw?.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : seedSeo.description,
    keywords:
      typeof raw?.keywords === "string" ? raw.keywords.trim() : seedSeo.keywords,
    ogTitle:
      typeof raw?.ogTitle === "string" ? raw.ogTitle.trim() : seedSeo.ogTitle,
    ogDescription:
      typeof raw?.ogDescription === "string"
        ? raw.ogDescription.trim()
        : seedSeo.ogDescription,
    ogImageUrl:
      typeof raw?.ogImageUrl === "string" ? raw.ogImageUrl.trim() : "",
    twitterCard,
    twitterHandle:
      typeof raw?.twitterHandle === "string" ? raw.twitterHandle.trim() : "",
    robotsIndex: raw?.robotsIndex !== false,
    robotsFollow: raw?.robotsFollow !== false,
    robotsExtra:
      typeof raw?.robotsExtra === "string" ? raw.robotsExtra.trim() : "",
    robotsTxtExtra:
      typeof raw?.robotsTxtExtra === "string" ? raw.robotsTxtExtra : "",
    sitemapEnabled: raw?.sitemapEnabled !== false,
    noindexPaths:
      typeof raw?.noindexPaths === "string"
        ? raw.noindexPaths
        : seedSeo.noindexPaths,
    googleVerification:
      typeof raw?.googleVerification === "string"
        ? raw.googleVerification.trim()
        : "",
    yandexVerification:
      typeof raw?.yandexVerification === "string"
        ? raw.yandexVerification.trim()
        : "",
    bingVerification:
      typeof raw?.bingVerification === "string"
        ? raw.bingVerification.trim()
        : "",
    jsonLdEnabled: raw?.jsonLdEnabled !== false,
    organizationName:
      typeof raw?.organizationName === "string"
        ? raw.organizationName.trim()
        : seedSeo.organizationName,
    organizationLogoUrl:
      typeof raw?.organizationLogoUrl === "string"
        ? raw.organizationLogoUrl.trim()
        : "",
    contactEmail:
      typeof raw?.contactEmail === "string" ? raw.contactEmail.trim() : "",
    contactTelegram:
      typeof raw?.contactTelegram === "string"
        ? raw.contactTelegram.trim()
        : "",
    googleAnalyticsId:
      typeof raw?.googleAnalyticsId === "string"
        ? raw.googleAnalyticsId.trim()
        : "",
    yandexMetricaId:
      typeof raw?.yandexMetricaId === "string"
        ? raw.yandexMetricaId.trim()
        : "",
    gtmId: typeof raw?.gtmId === "string" ? raw.gtmId.trim() : "",
  };
}

function reviewStatsForExchanger(
  exchangerId: string,
  all: ExchangerReview[],
): Pick<
  FeedExchanger,
  "reviews" | "reviewsPositive" | "reviewsNegative" | "rating"
> {
  const approved = all.filter(
    (r) => r.exchangerId === exchangerId && r.status === "approved",
  );
  const positive = approved.filter((r) => r.sentiment === "positive").length;
  const negative = approved.filter((r) => r.sentiment === "negative").length;
  const total = positive + negative;
  return {
    reviewsPositive: positive,
    reviewsNegative: negative,
    reviews: total,
    rating: total === 0 ? 0 : Math.round((positive / total) * 5 * 100) / 100,
  };
}

async function recomputeExchangerReviewStats(
  exchangerId: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.exchangerId, exchangerId));
  const stats = reviewStatsForExchanger(exchangerId, rows.map(mapReview));
  await db
    .update(exchangers)
    .set({
      reviews: stats.reviews,
      reviewsPositive: stats.reviewsPositive,
      reviewsNegative: stats.reviewsNegative,
      rating: stats.rating,
    })
    .where(eq(exchangers.id, exchangerId));

  try {
    const { recomputeExchangerAchievements } = await import(
      "@/lib/achievements-auto"
    );
    await recomputeExchangerAchievements(exchangerId);
  } catch (error) {
    console.error(
      "[gapsnap] achievement recompute after reviews failed",
      error,
    );
  }
}

export async function getLastGlobalSyncAt(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ lastGlobalSyncAt: appMeta.lastGlobalSyncAt })
    .from(appMeta)
    .where(eq(appMeta.id, 1))
    .limit(1);
  return row?.lastGlobalSyncAt ?? null;
}

export async function getRatesCount(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ n: count() }).from(rates);
  return row?.n ?? 0;
}

/**
 * Top directions by live offer count among active (non-blacklisted) exchangers.
 * Proxy for client demand: more competing offers ⇒ higher market demand.
 */
export async function getTopDemandPairs(options: {
  mode: "online" | "cash";
  limit?: number;
}): Promise<[string, string][]> {
  const limit = options.limit ?? 6;
  const db = getDb();
  const [exRows, blRows] = await Promise.all([
    db
      .select({
        id: exchangers.id,
        name: exchangers.name,
        slug: exchangers.slug,
      })
      .from(exchangers)
      .where(eq(exchangers.status, "active")),
    db.select().from(blacklist),
  ]);
  const activeIds = exRows
    .filter((e) => !isExchangerBlacklisted(e, blRows))
    .map((e) => e.id);
  if (!activeIds.length) return [];

  const cashFilter = or(
    sql`coalesce(${rates.city}, '') <> ''`,
    sql`${rates.from} ILIKE 'CASH%'`,
    sql`${rates.to} ILIKE 'CASH%'`,
  );
  const onlineFilter = and(
    sql`coalesce(${rates.city}, '') = ''`,
    sql`${rates.from} NOT ILIKE 'CASH%'`,
    sql`${rates.to} NOT ILIKE 'CASH%'`,
  );

  const rows = await db
    .select({
      from: rates.from,
      to: rates.to,
      n: sql<number>`count(*)::int`,
    })
    .from(rates)
    .where(
      and(
        inArray(rates.exchangerId, activeIds),
        options.mode === "cash" ? cashFilter : onlineFilter,
      ),
    )
    .groupBy(rates.from, rates.to)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((r) => [r.from, r.to] as [string, string]);
}

export async function getStore(): Promise<StoreData> {
  const db = getDb();
  const [
    exchangerRows,
    rateRows,
    blacklistRows,
    tagRows,
    reviewRows,
    achievementRows,
    adRows,
    tariffRows,
    pricingRows,
    seoRows,
    metaRows,
  ] = await Promise.all([
    db.select().from(exchangers),
    db.select().from(rates),
    db.select().from(blacklist),
    db.select().from(qualityTags),
    db.select().from(reviews),
    db.select().from(achievements),
    db.select().from(ads),
    db.select().from(adTariffs),
    db.select().from(adPricing).where(eq(adPricing.id, 1)).limit(1),
    db.select().from(seo).where(eq(seo.id, 1)).limit(1),
    db.select().from(appMeta).where(eq(appMeta.id, 1)).limit(1),
  ]);

  const pricing = pricingRows[0];
  return {
    exchangers: exchangerRows.map(mapExchanger),
    rates: rateRows.map(mapRate),
    blacklist: blacklistRows,
    qualityTags: tagRows,
    reviews: reviewRows.map(mapReview),
    achievements: achievementRows.map(mapAchievement),
    ads: adRows.map(mapAd),
    adTariffs: tariffRows.map(mapTariff),
    adPricing: pricing
      ? {
          contact: pricing.contact,
          intro: pricing.intro,
          note: pricing.note,
        }
      : structuredClone(seedAdPricing),
    seo: mapSeo(seoRows[0]),
    lastGlobalSyncAt: metaRows[0]?.lastGlobalSyncAt ?? null,
  };
}

export async function listExchangers(options?: {
  publicOnly?: boolean;
}): Promise<FeedExchanger[]> {
  const db = getDb();
  const [exRows, blRows] = await Promise.all([
    db.select().from(exchangers),
    db.select().from(blacklist),
  ]);
  const list = exRows.map(mapExchanger);
  if (!options?.publicOnly) return list;
  return list.filter(
    (e) =>
      (e.status === "active" || e.status === "error") &&
      !isExchangerBlacklisted(e, blRows),
  );
}

export async function getExchangerBySlug(
  slug: string,
  options?: { publicOnly?: boolean },
): Promise<FeedExchanger | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(exchangers)
    .where(eq(exchangers.slug, slug))
    .limit(1);
  if (!row) return undefined;
  const ex = mapExchanger(row);
  if (options?.publicOnly) {
    const bl = await listBlacklist();
    if (isExchangerBlacklisted(ex, bl)) return undefined;
  }
  return ex;
}

export async function getExchangerById(
  id: string,
): Promise<FeedExchanger | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(exchangers)
    .where(eq(exchangers.id, id))
    .limit(1);
  return row ? mapExchanger(row) : undefined;
}

/** Public path `/exchangers/{slug}` for ad click targets (active/error, not blacklisted). */
export async function listExchangerAdPathsByIds(
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, string>();
  if (!unique.length) return out;

  const db = getDb();
  const [rows, blRows] = await Promise.all([
    db
      .select({
        id: exchangers.id,
        slug: exchangers.slug,
        status: exchangers.status,
        name: exchangers.name,
      })
      .from(exchangers)
      .where(inArray(exchangers.id, unique)),
    db.select().from(blacklist),
  ]);

  for (const row of rows) {
    if (row.status !== "active" && row.status !== "error") continue;
    if (
      isExchangerBlacklisted(
        { id: row.id, name: row.name, slug: row.slug },
        blRows,
      )
    ) {
      continue;
    }
    if (!row.slug) continue;
    out.set(row.id, `/exchangers/${row.slug}`);
  }
  return out;
}

export async function getExchangerLogoBytes(
  id: string,
): Promise<{ format: "svg" | "png"; bytes: Buffer } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      format: exchangers.logoFormat,
      data: exchangers.logoData,
    })
    .from(exchangers)
    .where(eq(exchangers.id, id))
    .limit(1);
  if (!row?.data || (row.format !== "svg" && row.format !== "png")) {
    return null;
  }
  return { format: row.format, bytes: row.data };
}

export async function setExchangerLogoData(
  id: string,
  prepared: { format: "svg" | "png"; bytes: Buffer },
): Promise<ExchangerLogo> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  const result = await db
    .update(exchangers)
    .set({
      logoFormat: prepared.format,
      logoUpdatedAt: updatedAt,
      logoData: prepared.bytes,
    })
    .where(eq(exchangers.id, id))
    .returning({ id: exchangers.id });
  if (!result.length) {
    throw new Error("EXCHANGER_NOT_FOUND");
  }
  return { format: prepared.format, updatedAt };
}

export async function clearExchangerLogoData(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(exchangers)
    .set({
      logoFormat: null,
      logoUpdatedAt: null,
      logoData: null,
    })
    .where(eq(exchangers.id, id));
}

export async function getAdById(id: string): Promise<AdCreative | undefined> {
  const db = getDb();
  const [row] = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
  return row ? mapAd(row) : undefined;
}

export async function getAdImageBytes(
  id: string,
): Promise<{ format: AdImageFormat; bytes: Buffer } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      format: ads.imageFormat,
      data: ads.imageData,
    })
    .from(ads)
    .where(eq(ads.id, id))
    .limit(1);
  if (!row?.data || !isAdImageFormat(row.format)) {
    return null;
  }
  return { format: row.format, bytes: row.data };
}

export async function setAdImageData(
  id: string,
  prepared: { format: AdImageFormat; bytes: Buffer },
): Promise<{ format: AdImageFormat; updatedAt: string }> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  const imageUrl = `/api/ad-images/${encodeURIComponent(id)}?v=${encodeURIComponent(updatedAt)}`;
  const result = await db
    .update(ads)
    .set({
      imageFormat: prepared.format,
      imageUpdatedAt: updatedAt,
      imageData: prepared.bytes,
      imageUrl,
    })
    .where(eq(ads.id, id))
    .returning({ id: ads.id });
  if (!result.length) {
    throw new Error("AD_NOT_FOUND");
  }
  return { format: prepared.format, updatedAt };
}

export async function clearAdImageData(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(ads)
    .set({
      imageFormat: null,
      imageUpdatedAt: null,
      imageData: null,
      imageUrl: "",
    })
    .where(eq(ads.id, id));
}

export async function listSiteAssetMeta(): Promise<SiteAssetMeta[]> {
  const db = getDb();
  const rows = await db
    .select({
      kind: siteAssets.kind,
      format: siteAssets.format,
      updatedAt: siteAssets.updatedAt,
    })
    .from(siteAssets);
  const out: SiteAssetMeta[] = [];
  for (const row of rows) {
    if (!isSiteAssetFormat(row.format)) continue;
    if (!(SITE_ASSET_KINDS as readonly string[]).includes(row.kind)) continue;
    out.push({
      kind: row.kind as SiteAssetKind,
      format: row.format,
      updatedAt: row.updatedAt,
    });
  }
  return out;
}

export async function getSiteAssetMeta(
  kind: SiteAssetKind,
): Promise<SiteAssetMeta | null> {
  const db = getDb();
  const [row] = await db
    .select({
      kind: siteAssets.kind,
      format: siteAssets.format,
      updatedAt: siteAssets.updatedAt,
    })
    .from(siteAssets)
    .where(eq(siteAssets.kind, kind))
    .limit(1);
  if (!row || !isSiteAssetFormat(row.format)) return null;
  return {
    kind,
    format: row.format,
    updatedAt: row.updatedAt,
  };
}

export async function getSiteAssetBytes(
  kind: SiteAssetKind,
): Promise<{ format: SiteAssetFormat; bytes: Buffer; updatedAt: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      format: siteAssets.format,
      data: siteAssets.data,
      updatedAt: siteAssets.updatedAt,
    })
    .from(siteAssets)
    .where(eq(siteAssets.kind, kind))
    .limit(1);
  if (!row?.data || !isSiteAssetFormat(row.format)) return null;
  return { format: row.format, bytes: row.data, updatedAt: row.updatedAt };
}

export async function setSiteAssetData(
  kind: SiteAssetKind,
  prepared: { format: SiteAssetFormat; bytes: Buffer },
): Promise<SiteAssetMeta> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  await db
    .insert(siteAssets)
    .values({
      kind,
      format: prepared.format,
      updatedAt,
      data: prepared.bytes,
    })
    .onConflictDoUpdate({
      target: siteAssets.kind,
      set: {
        format: prepared.format,
        updatedAt,
        data: prepared.bytes,
      },
    });
  return { kind, format: prepared.format, updatedAt };
}

export async function clearSiteAssetData(kind: SiteAssetKind): Promise<void> {
  const db = getDb();
  await db.delete(siteAssets).where(eq(siteAssets.kind, kind));
}

/**
 * Keep SEO OG / org logo URLs pointing at uploaded branding assets when
 * those fields are empty or already managed via /api/branding/*.
 */
export async function syncSeoUrlsFromBranding(): Promise<void> {
  const [assets, current] = await Promise.all([
    listSiteAssetMeta(),
    getSeoSettings(),
  ]);
  const byKind = new Map(assets.map((a) => [a.kind, a]));
  const logoUrl = brandingPublicUrl("logo", byKind.get("logo") ?? null);
  const ogUrl = brandingPublicUrl("og_image", byKind.get("og_image") ?? null);

  const patch: Partial<{
    organizationLogoUrl: string;
    ogImageUrl: string;
  }> = {};

  const orgIsManaged =
    !current.organizationLogoUrl.trim() ||
    current.organizationLogoUrl.startsWith("/api/branding/");
  if (orgIsManaged) {
    patch.organizationLogoUrl = logoUrl ?? "";
  }

  const ogIsManaged =
    !current.ogImageUrl.trim() ||
    current.ogImageUrl.startsWith("/api/branding/");
  if (ogIsManaged) {
    patch.ogImageUrl = ogUrl ?? "";
  }

  if (Object.keys(patch).length) {
    await updateSeoSettings(patch);
  }
}

export async function getBrandLogoUrl(): Promise<string> {
  const meta = await getSiteAssetMeta("logo");
  return brandingPublicUrl("logo", meta) ?? "/gapsnap-mark.png";
}

export async function getActiveRates(): Promise<StoredRate[]> {
  const db = getDb();
  const [exRows, blRows] = await Promise.all([
    db
      .select({ id: exchangers.id, name: exchangers.name, slug: exchangers.slug })
      .from(exchangers)
      .where(eq(exchangers.status, "active")),
    db.select().from(blacklist),
  ]);
  const activeIds = exRows
    .filter((e) => !isExchangerBlacklisted(e, blRows))
    .map((e) => e.id);
  if (!activeIds.length) return [];
  const rateRows = await db
    .select()
    .from(rates)
    .where(inArray(rates.exchangerId, activeIds));
  return rateRows.map(mapRate);
}

/** Distinct FROM→TO pairs from XML rates for one exchanger (admin ads scope). */
export async function listExchangerRatePairs(
  exchangerId: string,
): Promise<Array<{ from: string; to: string; key: string }>> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ from: rates.from, to: rates.to })
    .from(rates)
    .where(eq(rates.exchangerId, exchangerId));
  return rows
    .map((r) => ({
      from: r.from,
      to: r.to,
      key: `${r.from}:${r.to}`,
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "en"));
}

/** Match blacklist by linked id or by name (legacy free-text entries). */
export function isExchangerBlacklisted(
  ex: Pick<FeedExchanger, "id" | "name" | "slug">,
  blacklistItems: BlacklistItem[],
): boolean {
  const name = ex.name.trim().toLowerCase();
  const slug = ex.slug.trim().toLowerCase();
  return blacklistItems.some((b) => {
    if (b.exchangerId && b.exchangerId === ex.id) return true;
    const bn = b.name.trim().toLowerCase();
    return bn === name || bn === slug;
  });
}

export async function isSlugBlacklisted(slug: string): Promise<boolean> {
  const ex = await getExchangerBySlug(slug);
  const bl = await listBlacklist();
  if (ex) return isExchangerBlacklisted(ex, bl);
  const needle = slug.trim().toLowerCase();
  return bl.some((b) => b.name.trim().toLowerCase() === needle);
}

export async function addExchangerApplication(input: {
  id?: string;
  name: string;
  website: string;
  exchangeUrlTemplate?: string;
  feedUrl: string;
  contact: string;
  description: string;
  pairCount: number;
  logo?: { format: "svg" | "png"; updatedAt: string } | null;
  logoData?: Buffer | null;
  ownerLogin: string;
  ownerPasswordHash: string;
  ownerEmail: string;
}): Promise<FeedExchanger> {
  const db = getDb();
  const slugBase = slugify(input.name);
  let slug = slugBase;
  let i = 2;
  const id =
    input.id ??
    `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const ownerLogin = input.ownerLogin.trim().toLowerCase();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();

  const existing = await db
    .select({ slug: exchangers.slug, ownerLogin: exchangers.ownerLogin })
    .from(exchangers);
  while (existing.some((e) => e.slug === slug)) {
    slug = `${slugBase}-${i++}`;
  }
  if (existing.some((e) => e.ownerLogin && e.ownerLogin === ownerLogin)) {
    throw new Error("OWNER_LOGIN_TAKEN");
  }

  const logoMeta = input.logo ?? null;
  const hasLogoBytes = Boolean(input.logoData && logoMeta);

  const [row] = await db
    .insert(exchangers)
    .values({
      id,
      slug,
      name: input.name,
      website: input.website,
      exchangeUrlTemplate: (input.exchangeUrlTemplate ?? "").trim(),
      feedUrl: input.feedUrl,
      contact: input.contact,
      description: input.description,
      status: "pending",
      verified: false,
      rating: 0,
      reviews: 0,
      reviewsPositive: 0,
      reviewsNegative: 0,
      ageYears: 1,
      createdAt: new Date().toISOString(),
      approvedAt: null,
      lastSyncAt: null,
      lastError: null,
      pairCount: input.pairCount,
      achievementIds: [],
      logoFormat: hasLogoBytes ? logoMeta!.format : null,
      logoUpdatedAt: hasLogoBytes ? logoMeta!.updatedAt : null,
      logoData: hasLogoBytes ? input.logoData! : null,
      traffic: emptyExchangerTraffic() as ExchangerTrafficJson,
      bannerToken: null,
      bannerCheck: emptyBannerCheck() as BannerCheckJson,
      ownerLogin,
      ownerPasswordHash: input.ownerPasswordHash,
      ownerEmail,
      ownerTotpSecret: null,
      ownerTotpEnabled: false,
    })
    .returning();

  try {
    const { upsertEmailContact } = await import("@/lib/email/contacts");
    await upsertEmailContact({
      email: ownerEmail,
      source: "exchanger",
      label: input.name,
      exchangerId: id,
    });
  } catch {
    // mailing list is best-effort
  }

  return mapExchanger(row);
}

/** Admin: create exchanger without public apply / owner password. */
export async function createExchangerManual(input: {
  id?: string;
  name: string;
  website: string;
  exchangeUrlTemplate?: string;
  feedUrl: string;
  contact?: string;
  description?: string;
  pairCount?: number;
  status?: "pending" | "active";
  ownerEmail?: string | null;
  ownerLogin?: string | null;
}): Promise<FeedExchanger> {
  const db = getDb();
  const name = input.name.trim();
  const website = input.website.trim();
  const feedUrl = input.feedUrl.trim();
  const contact = (input.contact ?? "").trim();
  const description = (input.description ?? "").trim();
  const exchangeUrlTemplate = (input.exchangeUrlTemplate ?? "").trim();
  const status = input.status === "active" ? "active" : "pending";
  const ownerEmail = input.ownerEmail?.trim().toLowerCase() || null;
  const ownerLogin = input.ownerLogin?.trim().toLowerCase() || null;

  const slugBase = slugify(name) || "exchanger";
  let slug = slugBase;
  let i = 2;
  const id =
    input.id ??
    `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const existing = await db
    .select({ slug: exchangers.slug, ownerLogin: exchangers.ownerLogin })
    .from(exchangers);
  while (existing.some((e) => e.slug === slug)) {
    slug = `${slugBase}-${i++}`;
  }
  if (
    ownerLogin &&
    existing.some((e) => e.ownerLogin && e.ownerLogin === ownerLogin)
  ) {
    throw new Error("OWNER_LOGIN_TAKEN");
  }

  let apiId: number | null = null;
  if (status === "active") {
    const [maxRow] = await db
      .select({ maxId: sql<number>`coalesce(max(${exchangers.apiId}), 0)` })
      .from(exchangers);
    apiId = Number(maxRow?.maxId ?? 0) + 1;
  }

  const now = new Date().toISOString();
  const [row] = await db
    .insert(exchangers)
    .values({
      id,
      slug,
      name,
      website,
      exchangeUrlTemplate,
      feedUrl,
      contact,
      description:
        description ||
        (status === "active"
          ? "Добавлен вручную из админки."
          : "Черновик: добавлен вручную из админки."),
      status,
      verified: false,
      rating: 0,
      reviews: 0,
      reviewsPositive: 0,
      reviewsNegative: 0,
      ageYears: 1,
      createdAt: now,
      approvedAt: status === "active" ? now : null,
      lastSyncAt: null,
      lastError: null,
      pairCount: input.pairCount ?? 0,
      achievementIds: [],
      logoFormat: null,
      logoUpdatedAt: null,
      logoData: null,
      traffic: emptyExchangerTraffic() as ExchangerTrafficJson,
      bannerToken: null,
      bannerCheck: emptyBannerCheck() as BannerCheckJson,
      ownerLogin,
      ownerPasswordHash: null,
      ownerEmail,
      ownerTotpSecret: null,
      ownerTotpEnabled: false,
      apiId,
    })
    .returning();

  if (ownerEmail) {
    try {
      const { upsertEmailContact } = await import("@/lib/email/contacts");
      await upsertEmailContact({
        email: ownerEmail,
        source: "exchanger",
        label: name,
        exchangerId: id,
      });
    } catch {
      // mailing list is best-effort
    }
  }

  return mapExchanger(row);
}

export async function replaceExchangerRates(
  exchangerId: string,
  items: ParsedRateItem[],
  meta: { ok: true } | { ok: false; error: string },
): Promise<void> {
  await replaceExchangerRatesBatch([{ exchangerId, items, meta }]);
}

export async function replaceExchangerRatesBatch(
  updates: Array<{
    exchangerId: string;
    items: ParsedRateItem[];
    meta: { ok: true } | { ok: false; error: string };
  }>,
): Promise<void> {
  if (updates.length === 0) return;
  const syncedAt = new Date().toISOString();
  const db = getDb();

  await db.transaction(async (tx) => {
    for (const { exchangerId, items, meta } of updates) {
      const [ex] = await tx
        .select({
          id: exchangers.id,
          status: exchangers.status,
          pairCount: exchangers.pairCount,
        })
        .from(exchangers)
        .where(eq(exchangers.id, exchangerId))
        .limit(1);
      if (!ex) continue;

      if (meta.ok) {
        // Replace rates only on successful fetch — never wipe on failure.
        await tx.delete(rates).where(eq(rates.exchangerId, exchangerId));

        await tx
          .update(exchangers)
          .set({
            status: "active",
            lastError: null,
            lastSyncAt: syncedAt,
            pairCount: items.length,
          })
          .where(eq(exchangers.id, exchangerId));

        if (items.length) {
          const CHUNK = 400;
          const rows = items.map((item, index) => ({
            id: `${exchangerId}_${item.from}_${item.to}_${index}`,
            exchangerId,
            from: item.from,
            to: item.to,
            inAmount: item.in,
            outAmount: item.out,
            rate: item.rate,
            reserve: item.reserve,
            minAmount: item.minAmount,
            maxAmount: item.maxAmount,
            city: item.city ?? null,
            param: item.param ?? null,
            tofee: item.tofee ?? null,
            syncedAt,
          }));
          for (let i = 0; i < rows.length; i += CHUNK) {
            await tx.insert(rates).values(rows.slice(i, i + CHUNK));
          }
        }
      } else {
        // Soft-fail: keep previous rates on the board. Mark error only when
        // there is nothing left to show; otherwise stay active with lastError.
        const [rateCount] = await tx
          .select({ n: count() })
          .from(rates)
          .where(eq(rates.exchangerId, exchangerId));
        const cachedPairs = Number(rateCount?.n ?? 0);
        const hasCachedRates = cachedPairs > 0;
        await tx
          .update(exchangers)
          .set({
            status:
              ex.status === "pending"
                ? "pending"
                : hasCachedRates
                  ? "active"
                  : "error",
            lastError: meta.error,
            lastSyncAt: syncedAt,
            // Keep pairCount aligned with what is still in the rates table.
            ...(hasCachedRates ? { pairCount: cachedPairs } : {}),
          })
          .where(eq(exchangers.id, exchangerId));
      }
    }

    await tx
      .insert(appMeta)
      .values({ id: 1, lastGlobalSyncAt: syncedAt })
      .onConflictDoUpdate({
        target: appMeta.id,
        set: { lastGlobalSyncAt: syncedAt },
      });
  });
}

export async function getCurrenciesFromRates(): Promise<string[]> {
  const active = await getActiveRates();
  const set = new Set<string>();
  for (const r of active) {
    set.add(r.from);
    set.add(r.to);
  }
  return [...set].sort();
}

export async function updateExchanger(
  id: string,
  patch: Partial<
    Pick<
      FeedExchanger,
      | "name"
      | "website"
      | "exchangeUrlTemplate"
      | "feedUrl"
      | "contact"
      | "description"
      | "status"
      | "verified"
      | "achievementIds"
      | "logo"
      | "approvedAt"
    >
  >,
): Promise<FeedExchanger | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(exchangers)
    .where(eq(exchangers.id, id))
    .limit(1);
  if (!current) return null;

  let achievementIds = patch.achievementIds;
  if (achievementIds !== undefined) {
    const ach = await db
      .select({ id: achievements.id, mode: achievements.mode })
      .from(achievements);
    const valid = new Map(ach.map((a) => [a.id, parseAchievementMode(a.mode)]));
    const autoIds = new Set(
      [...valid.entries()]
        .filter(([, mode]) => mode === "auto")
        .map(([id]) => id),
    );
    // Admin patches only control manual badges; keep current auto awards.
    const fromPatchManual = achievementIds.filter(
      (aid) => valid.has(aid) && !autoIds.has(aid),
    );
    const currentAuto = (current.achievementIds ?? []).filter((aid) =>
      autoIds.has(aid),
    );
    achievementIds = [...new Set([...fromPatchManual, ...currentAuto])];
  }

  const becomingActive =
    patch.status === "active" && current.status !== "active";

  const nextApprovedAt =
    patch.approvedAt !== undefined
      ? patch.approvedAt
      : becomingActive && !current.approvedAt
        ? new Date().toISOString()
        : current.approvedAt;

  let nextApiId = current.apiId;
  if (nextApiId == null && (becomingActive || patch.status === "active")) {
    const [maxRow] = await db
      .select({ maxId: sql<number>`coalesce(max(${exchangers.apiId}), 0)` })
      .from(exchangers);
    nextApiId = Number(maxRow?.maxId ?? 0) + 1;
  }

  const logoPatch =
    patch.logo === undefined
      ? {}
      : patch.logo === null
        ? {
            logoFormat: null as string | null,
            logoUpdatedAt: null as string | null,
            logoData: null as Buffer | null,
          }
        : {
            logoFormat: patch.logo.format,
            logoUpdatedAt: patch.logo.updatedAt,
          };

  const [row] = await db
    .update(exchangers)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.website !== undefined ? { website: patch.website } : {}),
      ...(patch.exchangeUrlTemplate !== undefined
        ? { exchangeUrlTemplate: patch.exchangeUrlTemplate }
        : {}),
      ...(patch.feedUrl !== undefined ? { feedUrl: patch.feedUrl } : {}),
      ...(patch.contact !== undefined ? { contact: patch.contact } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
      ...(achievementIds !== undefined ? { achievementIds } : {}),
      approvedAt: nextApprovedAt,
      ...(nextApiId != null && current.apiId == null ? { apiId: nextApiId } : {}),
      ...logoPatch,
    })
    .where(eq(exchangers.id, id))
    .returning();

  if (patch.status && patch.status !== "active") {
    await db.delete(rates).where(eq(rates.exchangerId, id));
  }

  return row ? mapExchanger(row) : null;
}

/** Record that an invite email was sent (or re-sent) to this exchanger. */
export async function markExchangerInviteSent(
  id: string,
  to: string,
  sentAt: string = new Date().toISOString(),
): Promise<FeedExchanger | null> {
  const db = getDb();
  const [row] = await db
    .update(exchangers)
    .set({
      inviteEmailSentAt: sentAt,
      inviteEmailTo: to.trim().toLowerCase(),
    })
    .where(eq(exchangers.id, id))
    .returning();
  return row ? mapExchanger(row) : null;
}

/** Ensure active exchanger has a banner token; create if missing. */
export async function ensureBannerToken(
  id: string,
): Promise<FeedExchanger | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(exchangers)
    .where(eq(exchangers.id, id))
    .limit(1);
  if (!current) return null;
  if (current.bannerToken) return mapExchanger(current);

  const token = newBannerToken();
  const [row] = await db
    .update(exchangers)
    .set({
      bannerToken: token,
      bannerCheck: emptyBannerCheck() as BannerCheckJson,
    })
    .where(eq(exchangers.id, id))
    .returning();
  return row ? mapExchanger(row) : null;
}

export async function updateBannerCheck(
  id: string,
  bannerCheck: BannerCheckJson,
): Promise<FeedExchanger | null> {
  const db = getDb();
  const [row] = await db
    .update(exchangers)
    .set({ bannerCheck })
    .where(eq(exchangers.id, id))
    .returning();
  return row ? mapExchanger(row) : null;
}

export async function deleteExchanger(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(exchangers)
    .where(eq(exchangers.id, id))
    .returning({ id: exchangers.id });
  return result.length > 0;
}

export async function listBlacklist(): Promise<BlacklistItem[]> {
  const db = getDb();
  return db.select().from(blacklist);
}

export async function addBlacklistItem(input: {
  name: string;
  reason: string;
  reports?: number;
  exchangerId?: string | null;
}): Promise<BlacklistItem> {
  const db = getDb();
  const name = input.name.trim();
  const reason = input.reason.trim();
  const exchangerId = input.exchangerId?.trim() || null;

  const existing = await db.select().from(blacklist);
  const dup = existing.some((b) => {
    if (exchangerId && b.exchangerId === exchangerId) return true;
    return b.name.trim().toLowerCase() === name.toLowerCase();
  });
  if (dup) throw new Error("ALREADY_BLACKLISTED");

  const item: BlacklistItem = {
    id: `bl_${Date.now().toString(36)}`,
    name,
    reason,
    reportedAt: new Date().toISOString().slice(0, 10),
    reports: input.reports ?? 1,
    exchangerId,
  };
  await db.insert(blacklist).values(item);
  return item;
}

export async function removeBlacklistItem(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(blacklist)
    .where(eq(blacklist.id, id))
    .returning({ id: blacklist.id });
  return result.length > 0;
}

export async function listQualityTags(options?: {
  activeOnly?: boolean;
}): Promise<ReviewQualityTag[]> {
  const db = getDb();
  const rows = await db.select().from(qualityTags);
  if (options?.activeOnly) return rows.filter((t) => t.active);
  return rows;
}

export async function addQualityTag(label: string): Promise<ReviewQualityTag> {
  const db = getDb();
  const tag: ReviewQualityTag = {
    id: `q_${Date.now().toString(36)}`,
    label: label.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.insert(qualityTags).values(tag);
  return tag;
}

export async function updateQualityTag(
  id: string,
  patch: Partial<Pick<ReviewQualityTag, "label" | "active">>,
): Promise<ReviewQualityTag | null> {
  const db = getDb();
  const [row] = await db
    .update(qualityTags)
    .set({
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    })
    .where(eq(qualityTags.id, id))
    .returning();
  return row ?? null;
}

export async function removeQualityTag(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(qualityTags)
    .where(eq(qualityTags.id, id))
    .returning({ id: qualityTags.id });
  return result.length > 0;
}

export async function listReviews(options?: {
  exchangerId?: string;
  status?: ReviewStatus;
}): Promise<ExchangerReview[]> {
  const db = getDb();
  const conditions = [];
  if (options?.exchangerId) {
    conditions.push(eq(reviews.exchangerId, options.exchangerId));
  }
  if (options?.status) {
    conditions.push(eq(reviews.status, options.status));
  }
  const rows =
    conditions.length === 0
      ? await db.select().from(reviews)
      : await db
          .select()
          .from(reviews)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions));
  return rows
    .map(mapReview)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addReview(input: {
  exchangerId: string;
  sentiment: ReviewSentiment;
  orderId: string;
  text: string;
  qualityTagIds: string[];
  email: string;
  confirmTokenHash: string;
  confirmExpiresAt: string;
}): Promise<ExchangerReview> {
  const db = getDb();
  const [ex] = await db
    .select()
    .from(exchangers)
    .where(eq(exchangers.id, input.exchangerId))
    .limit(1);
  if (!ex) throw new Error("Обменник не найден");
  if (ex.status !== "active" && ex.status !== "error") {
    throw new Error("Отзывы доступны только для активных обменников");
  }

  const tags = await db
    .select()
    .from(qualityTags)
    .where(eq(qualityTags.active, true));
  const activeTags = new Set(tags.map((t) => t.id));
  const qualityTagIds = input.qualityTagIds.filter((id) => activeTags.has(id));
  const email = input.email.trim().toLowerCase();

  const id = `rv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date().toISOString();

  const [row] = await db
    .insert(reviews)
    .values({
      id,
      exchangerId: ex.id,
      exchangerSlug: ex.slug,
      exchangerName: ex.name,
      sentiment: input.sentiment,
      orderId: input.orderId.trim(),
      text: input.text.trim(),
      qualityTagIds,
      status: "awaiting_email",
      createdAt,
      moderatedAt: null,
      ownerReply: null,
      ownerRepliedAt: null,
      threadClosed: false,
      email,
      emailVerifiedAt: null,
      confirmTokenHash: input.confirmTokenHash,
      confirmExpiresAt: input.confirmExpiresAt,
    })
    .returning();

  try {
    const { upsertEmailContact } = await import("@/lib/email/contacts");
    await upsertEmailContact({
      email,
      source: "review",
      label: ex.name,
      exchangerId: ex.id,
    });
  } catch {
    // mailing list is best-effort
  }

  return mapReview(row);
}

export async function deleteReviewHard(id: string): Promise<void> {
  const db = getDb();
  await db.delete(reviews).where(eq(reviews.id, id));
}

/** Confirm review email by raw token. Moves awaiting_email → pending. */
export async function confirmReviewEmail(
  rawToken: string,
): Promise<ExchangerReview | null> {
  const token = rawToken.trim();
  if (!token || token.length < 16) return null;

  const { createHash } = await import("crypto");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const now = new Date().toISOString();

  const [row] = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.confirmTokenHash, tokenHash),
        eq(reviews.status, "awaiting_email"),
      ),
    )
    .limit(1);

  if (!row) return null;
  if (row.confirmExpiresAt && row.confirmExpiresAt < now) {
    await db.delete(reviews).where(eq(reviews.id, row.id));
    return null;
  }

  const [updated] = await db
    .update(reviews)
    .set({
      status: "pending",
      emailVerifiedAt: now,
      confirmTokenHash: null,
      confirmExpiresAt: null,
    })
    .where(eq(reviews.id, row.id))
    .returning();

  return updated ? mapReview(updated) : null;
}

export async function replyToReview(
  reviewId: string,
  exchangerId: string,
  reply: string,
): Promise<ExchangerReview | null> {
  const { addReviewReply } = await import("@/lib/review-threads");
  await addReviewReply({
    reviewId,
    role: "owner",
    body: reply,
    exchangerId,
  });
  const db = getDb();
  const [row] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  return row ? mapReview(row) : null;
}

export async function findExchangerByOwnerLogin(
  login: string,
): Promise<FeedExchanger | undefined> {
  const needle = login.trim().toLowerCase();
  if (!needle) return undefined;
  const db = getDb();
  const [row] = await db
    .select()
    .from(exchangers)
    .where(eq(exchangers.ownerLogin, needle))
    .limit(1);
  return row ? mapExchanger(row) : undefined;
}

/** Match exchangers by ownerEmail (exact) or contact text containing the email. */
export async function findExchangersByOwnerEmail(
  email: string,
): Promise<FeedExchanger[]> {
  const needle = email.trim().toLowerCase();
  if (!needle || !needle.includes("@")) return [];

  const db = getDb();
  const rows = await db
    .select()
    .from(exchangers)
    .where(
      or(
        eq(exchangers.ownerEmail, needle),
        sql`position(${needle} in lower(coalesce(${exchangers.contact}, ''))) > 0`,
      ),
    );

  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const out: FeedExchanger[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    const direct = (row.ownerEmail ?? "").trim().toLowerCase();
    if (direct === needle) {
      seen.add(row.id);
      out.push(mapExchanger(row));
      continue;
    }
    const fromContact = row.contact.match(emailRe)?.[0]?.toLowerCase() ?? null;
    if (fromContact === needle) {
      seen.add(row.id);
      out.push(mapExchanger(row));
    }
  }
  return out;
}

export async function setOwnerCredentials(
  id: string,
  input: { ownerLogin: string; ownerPasswordHash: string },
): Promise<FeedExchanger | null> {
  const ownerLogin = input.ownerLogin.trim().toLowerCase();
  const db = getDb();

  const taken = await db
    .select({ id: exchangers.id })
    .from(exchangers)
    .where(and(eq(exchangers.ownerLogin, ownerLogin), ne(exchangers.id, id)))
    .limit(1);
  if (taken.length) throw new Error("OWNER_LOGIN_TAKEN");

  const [row] = await db
    .update(exchangers)
    .set({
      ownerLogin,
      ownerPasswordHash: input.ownerPasswordHash,
    })
    .where(eq(exchangers.id, id))
    .returning();
  return row ? mapExchanger(row) : null;
}

/** Reset password (+ optional first-time TOTP) for cabinet access remind. */
export async function resetOwnerAccessForRemind(
  id: string,
  input: {
    ownerLogin: string;
    ownerPasswordHash: string;
    totpSecret?: string | null;
    ownerEmail?: string | null;
  },
): Promise<FeedExchanger | null> {
  const ownerLogin = input.ownerLogin.trim().toLowerCase();
  const db = getDb();

  const taken = await db
    .select({ id: exchangers.id })
    .from(exchangers)
    .where(and(eq(exchangers.ownerLogin, ownerLogin), ne(exchangers.id, id)))
    .limit(1);
  if (taken.length) throw new Error("OWNER_LOGIN_TAKEN");

  const patch: {
    ownerLogin: string;
    ownerPasswordHash: string;
    ownerEmail?: string;
    ownerTotpSecret?: string;
    ownerTotpEnabled?: boolean;
  } = {
    ownerLogin,
    ownerPasswordHash: input.ownerPasswordHash,
  };
  if (input.ownerEmail) {
    patch.ownerEmail = input.ownerEmail.trim().toLowerCase();
  }
  if (input.totpSecret) {
    patch.ownerTotpSecret = input.totpSecret;
    patch.ownerTotpEnabled = true;
  }

  const [row] = await db
    .update(exchangers)
    .set(patch)
    .where(eq(exchangers.id, id))
    .returning();
  return row ? mapExchanger(row) : null;
}

/** Issue temp password + enable TOTP after moderation approval. */
export async function provisionOwnerAccessOnApproval(
  id: string,
  input: {
    ownerPasswordHash: string;
    totpSecret: string;
  },
): Promise<FeedExchanger | null> {
  const db = getDb();
  const [row] = await db
    .update(exchangers)
    .set({
      ownerPasswordHash: input.ownerPasswordHash,
      ownerTotpSecret: input.totpSecret,
      ownerTotpEnabled: true,
    })
    .where(eq(exchangers.id, id))
    .returning();
  return row ? mapExchanger(row) : null;
}

export async function moderateReview(
  id: string,
  status: "approved" | "rejected",
): Promise<ExchangerReview | null> {
  const db = getDb();
  const [row] = await db
    .update(reviews)
    .set({
      status,
      moderatedAt: new Date().toISOString(),
    })
    .where(eq(reviews.id, id))
    .returning();
  if (!row) return null;
  await recomputeExchangerReviewStats(row.exchangerId);
  return mapReview(row);
}

export async function deleteReview(id: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .delete(reviews)
    .where(eq(reviews.id, id))
    .returning();
  if (!row) return false;
  await recomputeExchangerReviewStats(row.exchangerId);
  return true;
}

export async function listAchievements(): Promise<ExchangerAchievement[]> {
  const db = getDb();
  const rows = await db.select().from(achievements);
  return rows
    .map(mapAchievement)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function resolveExchangerAchievements(
  achievementIds: string[] | undefined,
): Promise<ExchangerAchievement[]> {
  if (!achievementIds?.length) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(achievements)
    .where(inArray(achievements.id, achievementIds));
  const map = new Map(rows.map((a) => [a.id, mapAchievement(a)]));
  return achievementIds
    .map((id) => map.get(id))
    .filter((a): a is ExchangerAchievement => Boolean(a));
}

export async function addAchievement(input: {
  name: string;
  description: string;
  svg: string;
  mode?: AchievementMode;
  rule?: AchievementRule | null;
}): Promise<ExchangerAchievement> {
  const db = getDb();
  const mode = input.mode === "auto" ? "auto" : "manual";
  const rule = mode === "auto" ? (input.rule ?? null) : null;
  const item: ExchangerAchievement = {
    id: `ach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    svg: input.svg,
    mode,
    rule,
    createdAt: new Date().toISOString(),
  };
  await db.insert(achievements).values({
    id: item.id,
    name: item.name,
    description: item.description,
    svg: item.svg,
    mode: item.mode,
    rule: item.rule,
    createdAt: item.createdAt,
  });
  return item;
}

export async function updateAchievement(
  id: string,
  patch: Partial<
    Pick<ExchangerAchievement, "name" | "description" | "svg" | "mode" | "rule">
  >,
): Promise<ExchangerAchievement | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(achievements)
    .where(eq(achievements.id, id))
    .limit(1);
  if (!current) return null;

  const nextMode =
    patch.mode !== undefined
      ? parseAchievementMode(patch.mode)
      : parseAchievementMode(current.mode);
  const nextRule =
    nextMode === "manual"
      ? null
      : patch.rule !== undefined
        ? parseAchievementRule(patch.rule)
        : parseAchievementRule(current.rule);

  const [row] = await db
    .update(achievements)
    .set({
      ...(typeof patch.name === "string" && patch.name.trim()
        ? { name: patch.name.trim() }
        : {}),
      ...(typeof patch.description === "string"
        ? { description: patch.description.trim() }
        : {}),
      ...(typeof patch.svg === "string" && patch.svg.trim()
        ? { svg: patch.svg }
        : {}),
      ...(patch.mode !== undefined || patch.rule !== undefined
        ? { mode: nextMode, rule: nextRule }
        : {}),
    })
    .where(eq(achievements.id, id))
    .returning();
  return row ? mapAchievement(row) : null;
}

/** Write achievement IDs as-is (used by auto-assigner). Validates catalog IDs. */
export async function replaceExchangerAchievementIds(
  exchangerId: string,
  achievementIds: string[],
): Promise<boolean> {
  const db = getDb();
  const ach = await db.select({ id: achievements.id }).from(achievements);
  const valid = new Set(ach.map((a) => a.id));
  const next = [...new Set(achievementIds.filter((id) => valid.has(id)))];
  const result = await db
    .update(exchangers)
    .set({ achievementIds: next })
    .where(eq(exchangers.id, exchangerId))
    .returning({ id: exchangers.id });
  return result.length > 0;
}

export async function removeAchievement(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(achievements)
    .where(eq(achievements.id, id))
    .returning({ id: achievements.id });
  if (!result.length) return false;

  const all = await db.select({ id: exchangers.id, achievementIds: exchangers.achievementIds }).from(exchangers);
  for (const ex of all) {
    const ids = ex.achievementIds ?? [];
    if (!ids.includes(id)) continue;
    await db
      .update(exchangers)
      .set({ achievementIds: ids.filter((aid) => aid !== id) })
      .where(eq(exchangers.id, ex.id));
  }
  return true;
}

export async function listAds(): Promise<AdCreative[]> {
  const db = getDb();
  const rows = await db.select().from(ads);
  return rows
    .map(mapAd)
    .sort(
      (a, b) =>
        b.priority - a.priority || b.createdAt.localeCompare(a.createdAt),
    );
}

export async function listActiveAds(options?: {
  placement?: AdPlacement;
  type?: AdType;
}): Promise<AdCreative[]> {
  const { isAdLive, sortAds } = await import("@/lib/ads");
  let rows = (await listAds()).filter((ad) => isAdLive(ad));
  if (options?.placement) {
    rows = rows.filter((ad) => ad.placement === options.placement);
  }
  if (options?.type) {
    rows = rows.filter((ad) => ad.type === options.type);
  }
  return sortAds(rows);
}

export async function addAd(
  input: Omit<AdCreative, "id" | "createdAt" | "stats" | "image"> & {
    stats?: AdCreative["stats"];
    image?: AdCreative["image"];
  },
): Promise<AdCreative> {
  const db = getDb();
  const item: AdCreative = {
    ...input,
    pairs: input.pairs ?? [],
    image: input.image ?? null,
    id: `ad_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    stats: input.stats ? normalizeAdStats(input.stats) : emptyAdStats(),
  };
  await db.insert(ads).values({
    id: item.id,
    name: item.name,
    type: item.type,
    placement: item.placement,
    title: item.title,
    body: item.body,
    href: item.href,
    imageUrl: item.imageUrl,
    exchangerId: item.exchangerId,
    pairs: item.pairs ?? [],
    active: item.active,
    priority: item.priority,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    createdAt: item.createdAt,
    stats: item.stats as AdStatsJson,
  });
  return item;
}

export async function updateAd(
  id: string,
  patch: Partial<Omit<AdCreative, "id" | "createdAt">>,
): Promise<AdCreative | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(ads)
    .where(eq(ads.id, id))
    .limit(1);
  if (!current) return null;

  const nextStats = patch.stats
    ? normalizeAdStats(patch.stats)
    : normalizeAdStats(current.stats);

  const [row] = await db
    .update(ads)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.placement !== undefined ? { placement: patch.placement } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.href !== undefined ? { href: patch.href } : {}),
      ...(patch.imageUrl !== undefined
        ? {
            imageUrl: patch.imageUrl,
            // External URL replaces a previously uploaded file.
            ...(patch.imageUrl.startsWith("/api/ad-images/")
              ? {}
              : {
                  imageFormat: null,
                  imageUpdatedAt: null,
                  imageData: null,
                }),
          }
        : {}),
      ...(patch.exchangerId !== undefined
        ? { exchangerId: patch.exchangerId }
        : {}),
      ...(patch.pairs !== undefined ? { pairs: patch.pairs } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt } : {}),
      ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt } : {}),
      stats: nextStats as AdStatsJson,
    })
    .where(eq(ads.id, id))
    .returning();
  return row ? mapAd(row) : null;
}

export async function removeAd(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(ads)
    .where(eq(ads.id, id))
    .returning({ id: ads.id });
  return result.length > 0;
}

export type AdStatDelta = {
  id: string;
  impressions: number;
  clicks: number;
};

export async function applyAdStatDeltas(
  deltas: AdStatDelta[],
  keepDays = 30,
): Promise<void> {
  if (!deltas.length) return;
  const day = utcDayKey();
  const db = getDb();
  const ids = deltas.map((d) => d.id);
  const rows = await db.select().from(ads).where(inArray(ads.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  await db.transaction(async (tx) => {
    for (const delta of deltas) {
      const item = byId.get(delta.id);
      if (!item) continue;
      const stats = normalizeAdStats(item.stats);
      const nowIso = new Date().toISOString();
      if (delta.impressions > 0) {
        stats.impressions += delta.impressions;
        stats.lastImpressionAt = nowIso;
      }
      if (delta.clicks > 0) {
        stats.clicks += delta.clicks;
        stats.lastClickAt = nowIso;
      }
      let daily = stats.daily.find((d) => d.date === day);
      if (!daily) {
        daily = { date: day, impressions: 0, clicks: 0 };
        stats.daily.push(daily);
      }
      daily.impressions += Math.max(0, delta.impressions);
      daily.clicks += Math.max(0, delta.clicks);
      stats.daily = stats.daily
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-keepDays);

      await tx
        .update(ads)
        .set({ stats: stats as AdStatsJson })
        .where(eq(ads.id, delta.id));
    }
  });
}

export async function resetAdStats(id: string): Promise<AdCreative | null> {
  return updateAd(id, { stats: emptyAdStats() });
}

export async function listAdTariffs(options?: {
  activeOnly?: boolean;
}): Promise<AdTariff[]> {
  const db = getDb();
  const rows = await db.select().from(adTariffs);
  let list = rows.map(mapTariff);
  if (options?.activeOnly) list = list.filter((t) => t.active);
  return list.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ru"),
  );
}

export async function getAdPricing(): Promise<AdPricingSettings> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(adPricing)
    .where(eq(adPricing.id, 1))
    .limit(1);
  if (!row) return structuredClone(seedAdPricing);
  return {
    contact: row.contact,
    intro: row.intro,
    note: row.note,
  };
}

export async function updateAdPricing(
  patch: Partial<AdPricingSettings>,
): Promise<AdPricingSettings> {
  const current = await getAdPricing();
  const next = {
    contact:
      typeof patch.contact === "string" ? patch.contact.trim() : current.contact,
    intro: typeof patch.intro === "string" ? patch.intro.trim() : current.intro,
    note: typeof patch.note === "string" ? patch.note.trim() : current.note,
  };
  const db = getDb();
  await db
    .insert(adPricing)
    .values({ id: 1, ...next })
    .onConflictDoUpdate({
      target: adPricing.id,
      set: next,
    });
  return next;
}

export async function getSeoSettings(): Promise<SeoSettings> {
  const db = getDb();
  const [row] = await db.select().from(seo).where(eq(seo.id, 1)).limit(1);
  return normalizeSeoSettings(mapSeo(row));
}

export async function updateSeoSettings(
  patch: Partial<SeoSettings>,
): Promise<SeoSettings> {
  const current = await getSeoSettings();
  const merged = normalizeSeoSettings({ ...current, ...patch });
  const db = getDb();
  await db
    .insert(seo)
    .values({
      id: 1,
      siteName: merged.siteName,
      siteUrl: merged.siteUrl,
      titleDefault: merged.titleDefault,
      titleTemplate: merged.titleTemplate,
      description: merged.description,
      keywords: merged.keywords,
      ogTitle: merged.ogTitle,
      ogDescription: merged.ogDescription,
      ogImageUrl: merged.ogImageUrl,
      twitterCard: merged.twitterCard,
      twitterHandle: merged.twitterHandle,
      robotsIndex: merged.robotsIndex,
      robotsFollow: merged.robotsFollow,
      robotsExtra: merged.robotsExtra,
      robotsTxtExtra: merged.robotsTxtExtra,
      sitemapEnabled: merged.sitemapEnabled,
      noindexPaths: merged.noindexPaths,
      googleVerification: merged.googleVerification,
      yandexVerification: merged.yandexVerification,
      bingVerification: merged.bingVerification,
      jsonLdEnabled: merged.jsonLdEnabled,
      organizationName: merged.organizationName,
      organizationLogoUrl: merged.organizationLogoUrl,
      contactEmail: merged.contactEmail,
      contactTelegram: merged.contactTelegram,
      googleAnalyticsId: merged.googleAnalyticsId,
      yandexMetricaId: merged.yandexMetricaId,
      gtmId: merged.gtmId,
    })
    .onConflictDoUpdate({
      target: seo.id,
      set: {
        siteName: merged.siteName,
        siteUrl: merged.siteUrl,
        titleDefault: merged.titleDefault,
        titleTemplate: merged.titleTemplate,
        description: merged.description,
        keywords: merged.keywords,
        ogTitle: merged.ogTitle,
        ogDescription: merged.ogDescription,
        ogImageUrl: merged.ogImageUrl,
        twitterCard: merged.twitterCard,
        twitterHandle: merged.twitterHandle,
        robotsIndex: merged.robotsIndex,
        robotsFollow: merged.robotsFollow,
        robotsExtra: merged.robotsExtra,
        robotsTxtExtra: merged.robotsTxtExtra,
        sitemapEnabled: merged.sitemapEnabled,
        noindexPaths: merged.noindexPaths,
        googleVerification: merged.googleVerification,
        yandexVerification: merged.yandexVerification,
        bingVerification: merged.bingVerification,
        jsonLdEnabled: merged.jsonLdEnabled,
        organizationName: merged.organizationName,
        organizationLogoUrl: merged.organizationLogoUrl,
        contactEmail: merged.contactEmail,
        contactTelegram: merged.contactTelegram,
        googleAnalyticsId: merged.googleAnalyticsId,
        yandexMetricaId: merged.yandexMetricaId,
        gtmId: merged.gtmId,
      },
    });
  return merged;
}

function mapLegal(row: LegalRow): LegalSettings {
  return {
    privacyTitle: row.privacyTitle,
    privacyBody: row.privacyBody,
    privacyUpdatedAt: row.privacyUpdatedAt,
    cookieTitle: row.cookieTitle,
    cookieBody: row.cookieBody,
    cookieUpdatedAt: row.cookieUpdatedAt,
    termsTitle: row.termsTitle,
    termsBody: row.termsBody,
    termsUpdatedAt: row.termsUpdatedAt,
    bannerTitle: row.bannerTitle,
    bannerBody: row.bannerBody,
  };
}

function normalizeLegalSettings(
  raw: Partial<LegalSettings> | null | undefined,
): LegalSettings {
  const base = structuredClone(seedLegal);
  return {
    privacyTitle:
      typeof raw?.privacyTitle === "string" && raw.privacyTitle.trim()
        ? raw.privacyTitle.trim()
        : base.privacyTitle,
    privacyBody:
      typeof raw?.privacyBody === "string" ? raw.privacyBody : base.privacyBody,
    privacyUpdatedAt:
      typeof raw?.privacyUpdatedAt === "string" && raw.privacyUpdatedAt.trim()
        ? raw.privacyUpdatedAt
        : base.privacyUpdatedAt,
    cookieTitle:
      typeof raw?.cookieTitle === "string" && raw.cookieTitle.trim()
        ? raw.cookieTitle.trim()
        : base.cookieTitle,
    cookieBody:
      typeof raw?.cookieBody === "string" ? raw.cookieBody : base.cookieBody,
    cookieUpdatedAt:
      typeof raw?.cookieUpdatedAt === "string" && raw.cookieUpdatedAt.trim()
        ? raw.cookieUpdatedAt
        : base.cookieUpdatedAt,
    termsTitle:
      typeof raw?.termsTitle === "string" && raw.termsTitle.trim()
        ? raw.termsTitle.trim()
        : base.termsTitle,
    termsBody:
      typeof raw?.termsBody === "string" && raw.termsBody.trim()
        ? raw.termsBody
        : base.termsBody,
    termsUpdatedAt:
      typeof raw?.termsUpdatedAt === "string" && raw.termsUpdatedAt.trim()
        ? raw.termsUpdatedAt
        : base.termsUpdatedAt,
    bannerTitle:
      typeof raw?.bannerTitle === "string" && raw.bannerTitle.trim()
        ? raw.bannerTitle.trim()
        : base.bannerTitle,
    bannerBody:
      typeof raw?.bannerBody === "string" ? raw.bannerBody : base.bannerBody,
  };
}

export async function getLegalSettings(): Promise<LegalSettings> {
  const db = getDb();
  const [row] = await db.select().from(legal).where(eq(legal.id, 1)).limit(1);
  if (!row) {
    const seeded = normalizeLegalSettings(seedLegal);
    await db
      .insert(legal)
      .values({ id: 1, ...seeded })
      .onConflictDoNothing();
    return seeded;
  }
  return normalizeLegalSettings(mapLegal(row));
}

export async function updateLegalSettings(
  patch: Partial<LegalSettings>,
): Promise<LegalSettings> {
  const current = await getLegalSettings();
  const now = new Date().toISOString();
  const merged = normalizeLegalSettings({
    ...current,
    ...patch,
    privacyUpdatedAt:
      patch.privacyBody !== undefined || patch.privacyTitle !== undefined
        ? now
        : current.privacyUpdatedAt,
    cookieUpdatedAt:
      patch.cookieBody !== undefined || patch.cookieTitle !== undefined
        ? now
        : current.cookieUpdatedAt,
    termsUpdatedAt:
      patch.termsBody !== undefined || patch.termsTitle !== undefined
        ? now
        : current.termsUpdatedAt,
  });
  const db = getDb();
  await db
    .insert(legal)
    .values({ id: 1, ...merged })
    .onConflictDoUpdate({
      target: legal.id,
      set: { ...merged },
    });
  return merged;
}

export async function updateAdTariff(
  id: string,
  patch: Partial<
    Pick<
      AdTariff,
      | "title"
      | "description"
      | "sizeLabel"
      | "price"
      | "period"
      | "features"
      | "active"
      | "sortOrder"
      | "placement"
      | "type"
    >
  >,
): Promise<AdTariff | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(adTariffs)
    .where(eq(adTariffs.id, id))
    .limit(1);
  if (!current) return null;

  const set: Partial<typeof adTariffs.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof patch.title === "string" && patch.title.trim()) {
    set.title = patch.title.trim();
  }
  if (typeof patch.description === "string") {
    set.description = patch.description.trim();
  }
  if (typeof patch.sizeLabel === "string") {
    set.sizeLabel = patch.sizeLabel.trim();
  }
  if (typeof patch.price === "number" && Number.isFinite(patch.price)) {
    set.price = Math.max(0, patch.price);
  }
  if (
    patch.period === "day" ||
    patch.period === "week" ||
    patch.period === "month"
  ) {
    set.period = patch.period;
  }
  if (Array.isArray(patch.features)) {
    set.features = patch.features
      .filter((f): f is string => typeof f === "string")
      .map((f) => f.trim())
      .filter(Boolean);
  }
  if (typeof patch.active === "boolean") set.active = patch.active;
  if (typeof patch.sortOrder === "number") set.sortOrder = patch.sortOrder;
  if (patch.placement) set.placement = patch.placement;
  if (patch.type) set.type = patch.type;

  const [row] = await db
    .update(adTariffs)
    .set(set)
    .where(eq(adTariffs.id, id))
    .returning();
  return row ? mapTariff(row) : null;
}

export async function addAdTariff(input: {
  placement: AdPlacement;
  type: AdType;
  title: string;
  description?: string;
  sizeLabel?: string;
  price: number;
  period?: AdTariffPeriod;
  features?: string[];
  sortOrder?: number;
}): Promise<AdTariff> {
  const db = getDb();
  const item: AdTariff = {
    id: `tar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    placement: input.placement,
    type: input.type,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    sizeLabel: (input.sizeLabel ?? "").trim(),
    price: Math.max(0, input.price),
    period: input.period ?? "week",
    currency: "RUB",
    features: (input.features ?? []).map((f) => f.trim()).filter(Boolean),
    active: true,
    sortOrder: input.sortOrder ?? 100,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(adTariffs).values(item);
  return item;
}

export async function removeAdTariff(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(adTariffs)
    .where(eq(adTariffs.id, id))
    .returning({ id: adTariffs.id });
  return result.length > 0;
}

export type ExchangerTrafficDelta = {
  id: string;
  pageViews: number;
  siteClicks: number;
};

export async function applyExchangerTrafficDeltas(
  deltas: ExchangerTrafficDelta[],
  keepDays = 30,
): Promise<void> {
  if (!deltas.length) return;
  const day = utcDayKey();
  const db = getDb();
  const ids = deltas.map((d) => d.id);
  const rows = await db
    .select()
    .from(exchangers)
    .where(inArray(exchangers.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  await db.transaction(async (tx) => {
    for (const delta of deltas) {
      const item = byId.get(delta.id);
      if (!item) continue;
      const traffic = normalizeExchangerTraffic(item.traffic);
      const nowIso = new Date().toISOString();
      if (delta.pageViews > 0) {
        traffic.pageViews += delta.pageViews;
        traffic.lastViewAt = nowIso;
      }
      if (delta.siteClicks > 0) {
        traffic.siteClicks += delta.siteClicks;
        traffic.lastClickAt = nowIso;
      }
      let daily = traffic.daily.find((d) => d.date === day);
      if (!daily) {
        daily = { date: day, pageViews: 0, siteClicks: 0 };
        traffic.daily.push(daily);
      }
      daily.pageViews += Math.max(0, delta.pageViews);
      daily.siteClicks += Math.max(0, delta.siteClicks);
      traffic.daily = traffic.daily
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-keepDays);

      await tx
        .update(exchangers)
        .set({ traffic: traffic as ExchangerTrafficJson })
        .where(eq(exchangers.id, delta.id));
    }
  });
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/[а-яё]/gi, (ch) => {
        const map: Record<string, string> = {
          а: "a",
          б: "b",
          в: "v",
          г: "g",
          д: "d",
          е: "e",
          ё: "e",
          ж: "zh",
          з: "z",
          и: "i",
          й: "y",
          к: "k",
          л: "l",
          м: "m",
          н: "n",
          о: "o",
          п: "p",
          р: "r",
          с: "s",
          т: "t",
          у: "u",
          ф: "f",
          х: "h",
          ц: "ts",
          ч: "ch",
          ш: "sh",
          щ: "sch",
          ъ: "",
          ы: "y",
          ь: "",
          э: "e",
          ю: "yu",
          я: "ya",
        };
        return map[ch] ?? "";
      })
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "exchanger"
  );
}

function mapBlogPost(row: typeof blogPosts.$inferSelect): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverImageUrl: row.coverImageUrl,
    tags: row.tags ?? [],
    status: row.status === "published" ? "published" : "draft",
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    authorName: row.authorName,
    sourceProvider: row.sourceProvider ?? "",
    sourceId: row.sourceId ?? null,
    sourceUrl: row.sourceUrl ?? "",
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseNewsSyncResult(raw: string): NewsSyncResultSummary | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as NewsSyncResultSummary;
    if (
      typeof parsed?.fetched !== "number" ||
      typeof parsed?.created !== "number"
    ) {
      return null;
    }
    return {
      fetched: parsed.fetched,
      created: parsed.created,
      skipped: Number(parsed.skipped) || 0,
      failed: Number(parsed.failed) || 0,
      errors: Array.isArray(parsed.errors)
        ? parsed.errors.map(String)
        : [],
      syncedAt:
        typeof parsed.syncedAt === "string"
          ? parsed.syncedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function mapNewsSettings(row: typeof newsSettings.$inferSelect | undefined): NewsSettings {
  const proxyHosts = row?.proxyHosts ?? "";
  return {
    model: row?.model ?? "",
    rewritePrompt: row?.rewritePrompt ?? "",
    enabled: Boolean(row?.enabled),
    lastSyncAt: row?.lastSyncAt ?? null,
    lastSyncResult: parseNewsSyncResult(row?.lastSyncResult ?? ""),
    proxyEnabled: row?.proxyEnabled ?? true,
    proxyUser: row?.proxyUser ?? "",
    proxyPass: row?.proxyPass ?? "",
    proxyPort: Number(row?.proxyPort) > 0 ? Number(row?.proxyPort) : DEFAULT_PROXY_PORT,
    proxyHosts,
    proxyHostList: parseProxyHosts(proxyHosts),
    syncProgress: row?.syncProgress ?? "",
    syncStartedAt: row?.syncStartedAt ?? null,
    updatedAt: row?.updatedAt ?? "",
  };
}

export async function listBlogPosts(options?: {
  status?: BlogPostStatus | "all";
}): Promise<BlogPost[]> {
  const db = getDb();
  const status = options?.status ?? "all";
  const rows =
    status === "all"
      ? await db.select().from(blogPosts)
      : await db
          .select()
          .from(blogPosts)
          .where(eq(blogPosts.status, status));
  return rows
    .map(mapBlogPost)
    .sort((a, b) =>
      (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt),
    );
}

export async function getBlogPostBySlug(
  slug: string,
  options?: { publishedOnly?: boolean },
): Promise<BlogPost | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);
  if (!row) return undefined;
  const post = mapBlogPost(row);
  if (options?.publishedOnly && post.status !== "published") return undefined;
  return post;
}

export async function getBlogPostById(
  id: string,
): Promise<BlogPost | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, id))
    .limit(1);
  return row ? mapBlogPost(row) : undefined;
}

export async function getBlogPostBySourceId(
  sourceId: string,
): Promise<BlogPost | undefined> {
  const id = sourceId.trim();
  if (!id) return undefined;
  const db = getDb();
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.sourceId, id))
    .limit(1);
  return row ? mapBlogPost(row) : undefined;
}

export async function createBlogPost(input: {
  title: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  coverImageUrl?: string;
  tags?: string[];
  status?: BlogPostStatus;
  seoTitle?: string;
  seoDescription?: string;
  authorName?: string;
  sourceProvider?: string;
  sourceId?: string | null;
  sourceUrl?: string;
}): Promise<BlogPost> {
  const db = getDb();
  const now = new Date().toISOString();
  const baseSlug = slugify(input.slug?.trim() || input.title);
  let slug = baseSlug;
  let n = 2;
  while (true) {
    const [exists] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (!exists) break;
    slug = `${baseSlug}-${n++}`;
  }
  const status: BlogPostStatus =
    input.status === "published" ? "published" : "draft";
  const id = `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const sourceId = input.sourceId?.trim() || null;
  const [row] = await db
    .insert(blogPosts)
    .values({
      id,
      slug,
      title: input.title.trim(),
      excerpt: (input.excerpt ?? "").trim(),
      body: input.body ?? "",
      coverImageUrl: (input.coverImageUrl ?? "").trim(),
      tags: input.tags ?? [],
      status,
      seoTitle: (input.seoTitle ?? "").trim(),
      seoDescription: (input.seoDescription ?? "").trim(),
      authorName: (input.authorName ?? "").trim() || "GapSnap",
      sourceProvider: (input.sourceProvider ?? "").trim(),
      sourceId,
      sourceUrl: (input.sourceUrl ?? "").trim(),
      publishedAt: status === "published" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapBlogPost(row!);
}

export async function updateBlogPost(
  id: string,
  patch: Partial<
    Pick<
      BlogPost,
      | "title"
      | "slug"
      | "excerpt"
      | "body"
      | "coverImageUrl"
      | "tags"
      | "status"
      | "seoTitle"
      | "seoDescription"
      | "authorName"
      | "sourceProvider"
      | "sourceId"
      | "sourceUrl"
    >
  >,
): Promise<BlogPost | null> {
  const current = await getBlogPostById(id);
  if (!current) return null;
  const now = new Date().toISOString();
  let slug = current.slug;
  if (typeof patch.slug === "string" && patch.slug.trim()) {
    slug = slugify(patch.slug);
    if (slug !== current.slug) {
      const [exists] = await getDb()
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(and(eq(blogPosts.slug, slug), ne(blogPosts.id, id)))
        .limit(1);
      if (exists) slug = `${slug}-${Date.now().toString(36).slice(-3)}`;
    }
  }
  const status =
    patch.status === "published" || patch.status === "draft"
      ? patch.status
      : current.status;
  const publishedAt =
    status === "published"
      ? current.publishedAt || now
      : status === "draft"
        ? null
        : current.publishedAt;

  const sourceId =
    patch.sourceId !== undefined
      ? patch.sourceId?.trim() || null
      : current.sourceId;

  const [row] = await getDb()
    .update(blogPosts)
    .set({
      title: patch.title?.trim() ?? current.title,
      slug,
      excerpt:
        patch.excerpt !== undefined ? patch.excerpt.trim() : current.excerpt,
      body: patch.body !== undefined ? patch.body : current.body,
      coverImageUrl:
        patch.coverImageUrl !== undefined
          ? patch.coverImageUrl.trim()
          : current.coverImageUrl,
      tags: patch.tags ?? current.tags,
      status,
      seoTitle:
        patch.seoTitle !== undefined
          ? patch.seoTitle.trim()
          : current.seoTitle,
      seoDescription:
        patch.seoDescription !== undefined
          ? patch.seoDescription.trim()
          : current.seoDescription,
      authorName:
        patch.authorName !== undefined
          ? patch.authorName.trim()
          : current.authorName,
      sourceProvider:
        patch.sourceProvider !== undefined
          ? patch.sourceProvider.trim()
          : current.sourceProvider,
      sourceId,
      sourceUrl:
        patch.sourceUrl !== undefined
          ? patch.sourceUrl.trim()
          : current.sourceUrl,
      publishedAt,
      updatedAt: now,
    })
    .where(eq(blogPosts.id, id))
    .returning();
  return row ? mapBlogPost(row) : null;
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  const result = await getDb()
    .delete(blogPosts)
    .where(eq(blogPosts.id, id))
    .returning({ id: blogPosts.id });
  return result.length > 0;
}

async function ensureNewsSettingsRow(): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(newsSettings)
    .where(eq(newsSettings.id, 1))
    .limit(1);
  const { DEFAULT_NEWS_REWRITE_PROMPT } = await import(
    "@/lib/news/default-prompt"
  );
  const now = new Date().toISOString();
  const envUser = process.env.CODEX_PROXY_USER?.trim() ?? "";
  const envPass = process.env.CODEX_PROXY_PASS?.trim() ?? "";
  const envPort = Number(process.env.CODEX_PROXY_PORT ?? "");
  const defaultHosts = formatProxyHosts(DEFAULT_PROXY_HOSTS);

  if (!row) {
    await db
      .insert(newsSettings)
      .values({
        id: 1,
        model: "",
        rewritePrompt: DEFAULT_NEWS_REWRITE_PROMPT,
        enabled: false,
        lastSyncAt: null,
        lastSyncResult: "",
        proxyEnabled: true,
        proxyUser: envUser,
        proxyPass: envPass,
        proxyPort:
          Number.isFinite(envPort) && envPort > 0
            ? Math.floor(envPort)
            : DEFAULT_PROXY_PORT,
        proxyHosts: defaultHosts,
        syncProgress: "",
        syncStartedAt: null,
        updatedAt: now,
      })
      .onConflictDoNothing();
    return;
  }

  // Backfill empty proxy pool / credentials once after migration
  const patch: Record<string, unknown> = {};
  if (!(row.proxyHosts ?? "").trim()) patch.proxyHosts = defaultHosts;
  if (!(row.proxyUser ?? "").trim() && envUser) patch.proxyUser = envUser;
  if (!(row.proxyPass ?? "").trim() && envPass) patch.proxyPass = envPass;
  if (!row.proxyPort || row.proxyPort <= 0) {
    patch.proxyPort =
      Number.isFinite(envPort) && envPort > 0
        ? Math.floor(envPort)
        : DEFAULT_PROXY_PORT;
  }
  if (Object.keys(patch).length) {
    patch.updatedAt = now;
    await db
      .update(newsSettings)
      .set(patch)
      .where(eq(newsSettings.id, 1));
  }
}

export async function getNewsSettings(): Promise<NewsSettings> {
  await ensureNewsSettingsRow();
  const db = getDb();
  const [row] = await db
    .select()
    .from(newsSettings)
    .where(eq(newsSettings.id, 1))
    .limit(1);
  const mapped = mapNewsSettings(row);
  if (!mapped.rewritePrompt.trim()) {
    const { DEFAULT_NEWS_REWRITE_PROMPT } = await import(
      "@/lib/news/default-prompt"
    );
    return { ...mapped, rewritePrompt: DEFAULT_NEWS_REWRITE_PROMPT };
  }
  return mapped;
}

export async function updateNewsSettings(
  patch: Partial<
    Pick<
      NewsSettings,
      | "model"
      | "rewritePrompt"
      | "enabled"
      | "proxyEnabled"
      | "proxyUser"
      | "proxyPass"
      | "proxyPort"
      | "proxyHosts"
    >
  > & {
    lastSyncAt?: string | null;
    lastSyncResult?: NewsSyncResultSummary | null;
  },
): Promise<NewsSettings> {
  await ensureNewsSettingsRow();
  const current = await getNewsSettings();
  const now = new Date().toISOString();

  const proxyHostsRaw =
    typeof patch.proxyHosts === "string"
      ? formatProxyHosts(parseProxyHosts(patch.proxyHosts))
      : current.proxyHosts;

  const next = {
    model: typeof patch.model === "string" ? patch.model.trim() : current.model,
    rewritePrompt:
      typeof patch.rewritePrompt === "string"
        ? patch.rewritePrompt
        : current.rewritePrompt,
    enabled:
      typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    lastSyncAt:
      patch.lastSyncAt !== undefined ? patch.lastSyncAt : current.lastSyncAt,
    lastSyncResult:
      patch.lastSyncResult !== undefined
        ? patch.lastSyncResult
          ? JSON.stringify(patch.lastSyncResult)
          : ""
        : current.lastSyncResult
          ? JSON.stringify(current.lastSyncResult)
          : "",
    proxyEnabled:
      typeof patch.proxyEnabled === "boolean"
        ? patch.proxyEnabled
        : current.proxyEnabled,
    proxyUser:
      typeof patch.proxyUser === "string"
        ? patch.proxyUser.trim()
        : current.proxyUser,
    proxyPass:
      typeof patch.proxyPass === "string" ? patch.proxyPass : current.proxyPass,
    proxyPort:
      typeof patch.proxyPort === "number" && patch.proxyPort > 0
        ? Math.floor(patch.proxyPort)
        : current.proxyPort,
    proxyHosts: proxyHostsRaw,
    updatedAt: now,
  };

  const db = getDb();
  await db
    .insert(newsSettings)
    .values({ id: 1, ...next })
    .onConflictDoUpdate({
      target: newsSettings.id,
      set: next,
    });

  try {
    const { resetProxyPool } = await import("@/lib/ai/proxy-pool");
    resetProxyPool();
  } catch {
    /* ignore */
  }

  return getNewsSettings();
}

/** Lightweight live sync status — does not touch proxy settings / pool. */
export async function setNewsSyncLiveStatus(input: {
  progress?: string;
  startedAt?: string | null;
  clear?: boolean;
}): Promise<void> {
  await ensureNewsSettingsRow();
  const db = getDb();
  const patch: {
    syncProgress?: string;
    syncStartedAt?: string | null;
  } = {};
  if (input.clear) {
    patch.syncProgress = "";
    patch.syncStartedAt = null;
  } else {
    if (typeof input.progress === "string") patch.syncProgress = input.progress;
    if (input.startedAt !== undefined) patch.syncStartedAt = input.startedAt;
  }
  if (!Object.keys(patch).length) return;
  await db.update(newsSettings).set(patch).where(eq(newsSettings.id, 1));
}

/** Distinct active (from,to) pairs for sitemap / hub pages. */
export async function listActiveRatePairs(
  limit = 400,
): Promise<[string, string][]> {
  const active = await getActiveRates();
  const counts = new Map<string, { from: string; to: string; n: number }>();
  for (const r of active) {
    const key = `${r.from}:${r.to}`;
    const cur = counts.get(key);
    if (cur) cur.n += 1;
    else counts.set(key, { from: r.from, to: r.to, n: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => [x.from, x.to] as [string, string]);
}
