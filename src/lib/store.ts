import { promises as fs } from "fs";
import path from "path";
import { emptyAdStats, normalizeAdStats, utcDayKey } from "@/lib/ads";
import {
  emptyExchangerTraffic,
  normalizeExchangerTraffic,
} from "@/lib/exchanger-traffic";
import type { ParsedRateItem } from "@/lib/xml/parse-rates";
import type {
  AdCreative,
  AdPlacement,
  AdType,
  BlacklistItem,
  ExchangerAchievement,
  ExchangerReview,
  FeedExchanger,
  FeedExchangerStatus,
  ReviewQualityTag,
  ReviewSentiment,
  ReviewStatus,
} from "@/lib/store-types";

export type {
  AdCreative,
  AdPlacement,
  AdType,
  BlacklistItem,
  ExchangerAchievement,
  ExchangerReview,
  FeedExchanger,
  FeedExchangerStatus,
  ReviewQualityTag,
  ReviewSentiment,
  ReviewStatus,
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
  lastGlobalSyncAt: string | null;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const seedBlacklist: BlacklistItem[] = [
  {
    id: "b1",
    name: "QuickCoin24",
    reason: "AML-скам: блокировка средств после оплаты и требование «доплаты».",
    reportedAt: "2026-05-12",
    reports: 47,
  },
  {
    id: "b2",
    name: "TurboBit Exchange",
    reason: "Невыплата по подтверждённым заявкам, поддержка перестала отвечать.",
    reportedAt: "2026-03-28",
    reports: 31,
  },
  {
    id: "b3",
    name: "RubleRocket",
    reason: "Поддельные реквизиты и фишинговые зеркала официального сайта.",
    reportedAt: "2026-01-09",
    reports: 62,
  },
  {
    id: "b4",
    name: "ShadowPay Pro",
    reason: "Массовые жалобы на подмену курса после создания заявки.",
    reportedAt: "2025-11-17",
    reports: 24,
  },
];

const seedQualityTags: ReviewQualityTag[] = [
  {
    id: "q_fast",
    label: "Быстрый",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "q_24_7",
    label: "Круглосуточный",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "q_support",
    label: "Отзывчивая поддержка",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "q_rate",
    label: "Выгодный курс",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "q_trust",
    label: "Надёжный",
    active: true,
    createdAt: new Date().toISOString(),
  },
];

const seedExchangers: FeedExchanger[] = [
  {
    id: "kubex",
    slug: "kubex",
    name: "Kubex",
    website: "https://kubex.me",
    feedUrl: "https://kubex.me/exports/valuta.xml",
    contact: "seed@cryptomon.local",
    description:
      "Пример обменника с публичным BestChange-совместимым XML-фидом курсов.",
    status: "active",
    verified: true,
    rating: 0,
    reviews: 0,
    reviewsPositive: 0,
    reviewsNegative: 0,
    ageYears: 3,
    createdAt: new Date().toISOString(),
    approvedAt: "2025-05-01T00:00:00.000Z",
    lastSyncAt: null,
    lastError: null,
    pairCount: 0,
    achievementIds: [],
    logo: null,
    traffic: emptyExchangerTraffic(),
  },
];

function emptyStore(): StoreData {
  return {
    exchangers: structuredClone(seedExchangers),
    rates: [],
    blacklist: structuredClone(seedBlacklist),
    qualityTags: structuredClone(seedQualityTags),
    reviews: [],
    achievements: [],
    ads: [],
    lastGlobalSyncAt: null,
  };
}

let memory: StoreData | null = null;
let memoryMtimeMs = 0;
let loadPromise: Promise<StoreData> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

/** Rating = (positive / (positive + negative)) * 5 from approved reviews. */
function applyReviewStats(
  ex: FeedExchanger,
  reviews: ExchangerReview[],
): void {
  const approved = reviews.filter(
    (r) => r.exchangerId === ex.id && r.status === "approved",
  );
  const positive = approved.filter((r) => r.sentiment === "positive").length;
  const negative = approved.filter((r) => r.sentiment === "negative").length;
  const total = positive + negative;
  ex.reviewsPositive = positive;
  ex.reviewsNegative = negative;
  ex.reviews = total;
  ex.rating =
    total === 0 ? 0 : Math.round((positive / total) * 5 * 100) / 100;
}

function normalizeExchanger(
  ex: Partial<FeedExchanger> & { id: string },
): FeedExchanger {
  const slug = ex.slug?.trim() || slugify(ex.name || ex.id);
  const name =
    typeof ex.name === "string" && ex.name.trim()
      ? ex.name.trim()
      : slug || ex.id;

  return {
    id: ex.id,
    slug,
    name,
    website: typeof ex.website === "string" ? ex.website : "",
    feedUrl: typeof ex.feedUrl === "string" ? ex.feedUrl : "",
    contact: typeof ex.contact === "string" ? ex.contact : "",
    description: typeof ex.description === "string" ? ex.description : "",
    status: ex.status ?? "pending",
    verified: Boolean(ex.verified),
    rating: typeof ex.rating === "number" ? ex.rating : 0,
    reviews: typeof ex.reviews === "number" ? ex.reviews : 0,
    reviewsPositive:
      typeof ex.reviewsPositive === "number" ? ex.reviewsPositive : 0,
    reviewsNegative:
      typeof ex.reviewsNegative === "number" ? ex.reviewsNegative : 0,
    ageYears: typeof ex.ageYears === "number" ? ex.ageYears : 1,
    createdAt: ex.createdAt ?? new Date().toISOString(),
    approvedAt:
      typeof ex.approvedAt === "string" && ex.approvedAt
        ? ex.approvedAt
        : ex.status === "active" || ex.status === "error"
          ? (ex.createdAt ?? null)
          : null,
    lastSyncAt: ex.lastSyncAt ?? null,
    lastError: ex.lastError ?? null,
    pairCount: typeof ex.pairCount === "number" ? ex.pairCount : 0,
    achievementIds: Array.isArray(ex.achievementIds) ? ex.achievementIds : [],
    logo:
      ex.logo &&
      (ex.logo.format === "svg" || ex.logo.format === "png") &&
      typeof ex.logo.updatedAt === "string"
        ? { format: ex.logo.format, updatedAt: ex.logo.updatedAt }
        : null,
    traffic: normalizeExchangerTraffic(ex.traffic),
  };
}

function normalizeStore(parsed: Partial<StoreData>): {
  data: StoreData;
  migrated: boolean;
} {
  if (!parsed.exchangers?.length) {
    return { data: emptyStore(), migrated: true };
  }

  const hadTags = Array.isArray(parsed.qualityTags) && parsed.qualityTags.length > 0;
  const hadReviews = Array.isArray(parsed.reviews);
  const hadBlacklist = Array.isArray(parsed.blacklist) && parsed.blacklist.length > 0;
  const hadAchievements = Array.isArray(parsed.achievements);
  const hadAds = Array.isArray(parsed.ads);

  const exchangers = (parsed.exchangers ?? []).map((ex) =>
    normalizeExchanger(ex),
  );

  const ads: AdCreative[] = (hadAds ? parsed.ads! : []).map((raw) => {
    const ad = raw as Partial<AdCreative> & { id: string };
    return {
      id: ad.id,
      name: typeof ad.name === "string" ? ad.name : ad.id,
      type: ad.type ?? "banner",
      placement: ad.placement ?? "dashboard",
      title: typeof ad.title === "string" ? ad.title : "",
      body: typeof ad.body === "string" ? ad.body : "",
      href: typeof ad.href === "string" ? ad.href : "",
      imageUrl: typeof ad.imageUrl === "string" ? ad.imageUrl : "",
      exchangerId: ad.exchangerId ?? null,
      active: ad.active !== false,
      priority: typeof ad.priority === "number" ? ad.priority : 0,
      startsAt: ad.startsAt ?? null,
      endsAt: ad.endsAt ?? null,
      createdAt: ad.createdAt ?? new Date().toISOString(),
      stats: ad.stats ? normalizeAdStats(ad.stats) : emptyAdStats(),
    };
  });

  const data: StoreData = {
    exchangers,
    rates: parsed.rates ?? [],
    blacklist: hadBlacklist
      ? parsed.blacklist!
      : structuredClone(seedBlacklist),
    qualityTags: hadTags
      ? parsed.qualityTags!
      : structuredClone(seedQualityTags),
    reviews: hadReviews ? parsed.reviews! : [],
    achievements: hadAchievements ? parsed.achievements! : [],
    ads,
    lastGlobalSyncAt: parsed.lastGlobalSyncAt ?? null,
  };

  for (const ex of data.exchangers) {
    applyReviewStats(ex, data.reviews);
  }

  const needsRepair = (parsed.exchangers ?? []).some(
    (ex) =>
      !Array.isArray(ex.achievementIds) ||
      typeof ex.name !== "string" ||
      !ex.name.trim() ||
      typeof ex.feedUrl !== "string" ||
      typeof ex.reviewsPositive !== "number" ||
      typeof ex.reviewsNegative !== "number" ||
      !ex.traffic ||
      ((ex.status === "active" || ex.status === "error") && !ex.approvedAt),
  );
  const adsNeedStats = hadAds && (parsed.ads ?? []).some((ad) => !ad.stats);
  const migrated =
    !hadTags ||
    !hadReviews ||
    !hadBlacklist ||
    !hadAchievements ||
    !hadAds ||
    adsNeedStats ||
    needsRepair;
  return { data, migrated };
}

async function readStoreFromDisk(): Promise<{
  data: StoreData;
  mtimeMs: number;
  migrated: boolean;
}> {
  try {
    const stat = await fs.stat(STORE_PATH);
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    const { data, migrated } = normalizeStore(parsed);
    return { data, mtimeMs: stat.mtimeMs, migrated };
  } catch {
    return { data: emptyStore(), mtimeMs: 0, migrated: true };
  }
}

async function ensureLoaded(): Promise<StoreData> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const stat = await fs.stat(STORE_PATH);
      if (memory && stat.mtimeMs === memoryMtimeMs) {
        return memory;
      }
    } catch {
      // file missing — fall through to full reload
    }

    const { data, mtimeMs, migrated } = await readStoreFromDisk();
    memory = data;
    memoryMtimeMs = mtimeMs;

    if (migrated || mtimeMs === 0) {
      await withStoreLock(async () => {
        // Re-check under lock in case another instance already migrated.
        const fresh = await readStoreFromDisk();
        memory = fresh.data;
        memoryMtimeMs = fresh.mtimeMs;
        if (fresh.migrated || fresh.mtimeMs === 0) {
          await persist(memory);
        }
      });
    }

    return memory;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

async function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const lockPath = `${STORE_PATH}.lock`;
  await fs.mkdir(DATA_DIR, { recursive: true });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, "wx");
      try {
        return await fn();
      } finally {
        await handle.close();
        await fs.unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code !== "EEXIST") throw error;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
    }
  }

  throw new Error("Не удалось получить блокировку store.json");
}

async function persist(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  // Always keep reviews/qualityTags/achievements keys so other process instances cannot drop them.
  const payload: StoreData = {
    exchangers: data.exchangers,
    rates: data.rates,
    blacklist: data.blacklist ?? [],
    qualityTags: data.qualityTags ?? [],
    reviews: data.reviews ?? [],
    achievements: data.achievements ?? [],
    ads: data.ads ?? [],
    lastGlobalSyncAt: data.lastGlobalSyncAt ?? null,
  };
  const json = JSON.stringify(payload, null, 2);
  // Avoid fs.rename on Windows — it often throws EPERM when store.json is open,
  // which previously aborted writes and left achievements / names wiped.
  await fs.writeFile(tmp, json, "utf8");
  await fs.copyFile(tmp, STORE_PATH);
  await fs.unlink(tmp).catch(() => undefined);
  const stat = await fs.stat(STORE_PATH);
  memory = payload;
  memoryMtimeMs = stat.mtimeMs;
}

function enqueueWrite(mutator: (data: StoreData) => void): Promise<StoreData> {
  const run = writeQueue.then(async () =>
    withStoreLock(async () => {
      // Re-read disk under lock so route/poller module copies don't clobber each other.
      const { data } = await readStoreFromDisk();
      mutator(data);
      await persist(data);
      return data;
    }),
  );
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function getStore(): Promise<StoreData> {
  return ensureLoaded();
}

export async function listExchangers(options?: {
  publicOnly?: boolean;
}): Promise<FeedExchanger[]> {
  const store = await ensureLoaded();
  if (options?.publicOnly) {
    return store.exchangers.filter(
      (e) => e.status === "active" || e.status === "error",
    );
  }
  return store.exchangers;
}

export async function getExchangerBySlug(
  slug: string,
): Promise<FeedExchanger | undefined> {
  const store = await ensureLoaded();
  return store.exchangers.find((e) => e.slug === slug);
}

export async function getExchangerById(
  id: string,
): Promise<FeedExchanger | undefined> {
  const store = await ensureLoaded();
  return store.exchangers.find((e) => e.id === id);
}

export async function getActiveRates(): Promise<StoredRate[]> {
  const store = await ensureLoaded();
  const activeIds = new Set(
    store.exchangers.filter((e) => e.status === "active").map((e) => e.id),
  );
  return store.rates.filter((r) => activeIds.has(r.exchangerId));
}

export async function addExchangerApplication(input: {
  id?: string;
  name: string;
  website: string;
  feedUrl: string;
  contact: string;
  description: string;
  pairCount: number;
  logo?: { format: "svg" | "png"; updatedAt: string } | null;
}): Promise<FeedExchanger> {
  const slugBase = slugify(input.name);
  let slug = slugBase;
  let i = 2;
  const id =
    input.id ??
    `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const created = await enqueueWrite((data) => {
    while (data.exchangers.some((e) => e.slug === slug)) {
      slug = `${slugBase}-${i++}`;
    }

    const exchanger: FeedExchanger = {
      id,
      slug,
      name: input.name,
      website: input.website,
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
      logo: input.logo ?? null,
      traffic: emptyExchangerTraffic(),
    };

    data.exchangers.push(exchanger);
  });

  return created.exchangers.find((e) => e.id === id)!;
}

export async function replaceExchangerRates(
  exchangerId: string,
  items: ParsedRateItem[],
  meta: { ok: true } | { ok: false; error: string },
): Promise<void> {
  const syncedAt = new Date().toISOString();

  await enqueueWrite((data) => {
    const ex = data.exchangers.find((e) => e.id === exchangerId);
    if (!ex) return;

    data.rates = data.rates.filter((r) => r.exchangerId !== exchangerId);

    if (meta.ok) {
      ex.status = "active";
      ex.lastError = null;
      ex.lastSyncAt = syncedAt;
      ex.pairCount = items.length;
      data.rates.push(
        ...items.map((item, index) => ({
          ...item,
          id: `${exchangerId}_${item.from}_${item.to}_${index}`,
          exchangerId,
          syncedAt,
        })),
      );
    } else {
      ex.status = ex.status === "pending" ? "pending" : "error";
      ex.lastError = meta.error;
      ex.lastSyncAt = syncedAt;
    }

    data.lastGlobalSyncAt = syncedAt;
  });
}

export async function getCurrenciesFromRates(): Promise<string[]> {
  const rates = await getActiveRates();
  const set = new Set<string>();
  for (const r of rates) {
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
  let updated: FeedExchanger | null = null;
  await enqueueWrite((data) => {
    const ex = data.exchangers.find((e) => e.id === id);
    if (!ex) return;

    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as typeof patch;

    if (clean.achievementIds !== undefined) {
      const valid = new Set((data.achievements ?? []).map((a) => a.id));
      clean.achievementIds = clean.achievementIds.filter((aid) =>
        valid.has(aid),
      );
    }

    const becomingActive =
      clean.status === "active" && ex.status !== "active";

    Object.assign(ex, clean);
    if (!Array.isArray(ex.achievementIds)) ex.achievementIds = [];
    if (!ex.traffic) ex.traffic = emptyExchangerTraffic();

    // Первое одобрение фиксирует дату «работает с …»
    if (becomingActive && !ex.approvedAt) {
      ex.approvedAt = new Date().toISOString();
    }
    if (clean.approvedAt !== undefined) {
      ex.approvedAt = clean.approvedAt;
    }

    if (clean.status && clean.status !== "active") {
      data.rates = data.rates.filter((r) => r.exchangerId !== id);
    }
    updated = { ...ex };
  });
  return updated;
}

export async function deleteExchanger(id: string): Promise<boolean> {
  let removed = false;
  await enqueueWrite((data) => {
    const before = data.exchangers.length;
    data.exchangers = data.exchangers.filter((e) => e.id !== id);
    data.rates = data.rates.filter((r) => r.exchangerId !== id);
    data.reviews = data.reviews.filter((r) => r.exchangerId !== id);
    removed = data.exchangers.length < before;
  });
  if (removed) {
    const { deleteExchangerLogo } = await import("@/lib/logo");
    await deleteExchangerLogo(id);
  }
  return removed;
}

export async function listBlacklist(): Promise<BlacklistItem[]> {
  const store = await ensureLoaded();
  return store.blacklist;
}

export async function addBlacklistItem(input: {
  name: string;
  reason: string;
  reports?: number;
}): Promise<BlacklistItem> {
  const item: BlacklistItem = {
    id: `bl_${Date.now().toString(36)}`,
    name: input.name,
    reason: input.reason,
    reportedAt: new Date().toISOString().slice(0, 10),
    reports: input.reports ?? 1,
  };
  await enqueueWrite((data) => {
    data.blacklist.unshift(item);
  });
  return item;
}

export async function removeBlacklistItem(id: string): Promise<boolean> {
  let removed = false;
  await enqueueWrite((data) => {
    const before = data.blacklist.length;
    data.blacklist = data.blacklist.filter((b) => b.id !== id);
    removed = data.blacklist.length < before;
  });
  return removed;
}

export async function listQualityTags(options?: {
  activeOnly?: boolean;
}): Promise<ReviewQualityTag[]> {
  const store = await ensureLoaded();
  const tags = store.qualityTags ?? [];
  if (options?.activeOnly) return tags.filter((t) => t.active);
  return tags;
}

export async function addQualityTag(label: string): Promise<ReviewQualityTag> {
  const tag: ReviewQualityTag = {
    id: `q_${Date.now().toString(36)}`,
    label: label.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  await enqueueWrite((data) => {
    data.qualityTags = data.qualityTags ?? [];
    data.qualityTags.push(tag);
  });
  return tag;
}

export async function updateQualityTag(
  id: string,
  patch: Partial<Pick<ReviewQualityTag, "label" | "active">>,
): Promise<ReviewQualityTag | null> {
  let updated: ReviewQualityTag | null = null;
  await enqueueWrite((data) => {
    const tag = (data.qualityTags ?? []).find((t) => t.id === id);
    if (!tag) return;
    Object.assign(tag, patch);
    updated = { ...tag };
  });
  return updated;
}

export async function removeQualityTag(id: string): Promise<boolean> {
  let removed = false;
  await enqueueWrite((data) => {
    const before = (data.qualityTags ?? []).length;
    data.qualityTags = (data.qualityTags ?? []).filter((t) => t.id !== id);
    removed = data.qualityTags.length < before;
  });
  return removed;
}

export async function listReviews(options?: {
  exchangerId?: string;
  status?: ReviewStatus;
}): Promise<ExchangerReview[]> {
  const store = await ensureLoaded();
  let rows = store.reviews ?? [];
  if (options?.exchangerId) {
    rows = rows.filter((r) => r.exchangerId === options.exchangerId);
  }
  if (options?.status) {
    rows = rows.filter((r) => r.status === options.status);
  }
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addReview(input: {
  exchangerId: string;
  sentiment: ReviewSentiment;
  orderId: string;
  text: string;
  qualityTagIds: string[];
}): Promise<ExchangerReview> {
  const store = await ensureLoaded();
  const ex = store.exchangers.find((e) => e.id === input.exchangerId);
  if (!ex) throw new Error("Обменник не найден");
  if (ex.status !== "active" && ex.status !== "error") {
    throw new Error("Отзывы доступны только для активных обменников");
  }

  const activeTags = new Set(
    (store.qualityTags ?? []).filter((t) => t.active).map((t) => t.id),
  );
  const qualityTagIds = input.qualityTagIds.filter((id) => activeTags.has(id));

  const review: ExchangerReview = {
    id: `rv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    exchangerId: ex.id,
    exchangerSlug: ex.slug,
    exchangerName: ex.name,
    sentiment: input.sentiment,
    orderId: input.orderId.trim(),
    text: input.text.trim(),
    qualityTagIds,
    status: "pending",
    createdAt: new Date().toISOString(),
    moderatedAt: null,
  };

  await enqueueWrite((data) => {
    data.reviews = data.reviews ?? [];
    data.reviews.unshift(review);
  });

  return review;
}

export async function moderateReview(
  id: string,
  status: "approved" | "rejected",
): Promise<ExchangerReview | null> {
  let updated: ExchangerReview | null = null;

  await enqueueWrite((data) => {
    const review = (data.reviews ?? []).find((r) => r.id === id);
    if (!review) return;

    review.status = status;
    review.moderatedAt = new Date().toISOString();
    updated = { ...review };

    const ex = data.exchangers.find((e) => e.id === review.exchangerId);
    if (ex) applyReviewStats(ex, data.reviews ?? []);
  });

  return updated;
}

export async function deleteReview(id: string): Promise<boolean> {
  let removed = false;
  await enqueueWrite((data) => {
    const review = (data.reviews ?? []).find((r) => r.id === id);
    const before = (data.reviews ?? []).length;
    data.reviews = (data.reviews ?? []).filter((r) => r.id !== id);
    removed = data.reviews.length < before;
    if (removed && review) {
      const ex = data.exchangers.find((e) => e.id === review.exchangerId);
      if (ex) applyReviewStats(ex, data.reviews);
    }
  });
  return removed;
}

export async function listAchievements(): Promise<ExchangerAchievement[]> {
  const store = await ensureLoaded();
  return [...(store.achievements ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  );
}

export async function resolveExchangerAchievements(
  achievementIds: string[] | undefined,
): Promise<ExchangerAchievement[]> {
  if (!achievementIds?.length) return [];
  const store = await ensureLoaded();
  const map = new Map((store.achievements ?? []).map((a) => [a.id, a]));
  return achievementIds
    .map((id) => map.get(id))
    .filter((a): a is ExchangerAchievement => Boolean(a));
}

export async function addAchievement(input: {
  name: string;
  description: string;
  svg: string;
}): Promise<ExchangerAchievement> {
  const item: ExchangerAchievement = {
    id: `ach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    svg: input.svg,
    createdAt: new Date().toISOString(),
  };
  await enqueueWrite((data) => {
    data.achievements = data.achievements ?? [];
    data.achievements.push(item);
  });
  return item;
}

export async function updateAchievement(
  id: string,
  patch: Partial<Pick<ExchangerAchievement, "name" | "description" | "svg">>,
): Promise<ExchangerAchievement | null> {
  let updated: ExchangerAchievement | null = null;
  await enqueueWrite((data) => {
    const item = (data.achievements ?? []).find((a) => a.id === id);
    if (!item) return;
    if (typeof patch.name === "string" && patch.name.trim()) {
      item.name = patch.name.trim();
    }
    if (typeof patch.description === "string") {
      item.description = patch.description.trim();
    }
    if (typeof patch.svg === "string" && patch.svg.trim()) {
      item.svg = patch.svg;
    }
    updated = { ...item };
  });
  return updated;
}

export async function removeAchievement(id: string): Promise<boolean> {
  let removed = false;
  await enqueueWrite((data) => {
    const before = (data.achievements ?? []).length;
    data.achievements = (data.achievements ?? []).filter((a) => a.id !== id);
    removed = data.achievements.length < before;
    if (removed) {
      for (const ex of data.exchangers) {
        ex.achievementIds = (ex.achievementIds ?? []).filter((aid) => aid !== id);
      }
    }
  });
  return removed;
}

export async function listAds(): Promise<AdCreative[]> {
  const store = await ensureLoaded();
  return [...(store.ads ?? [])].sort(
    (a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt),
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
  input: Omit<AdCreative, "id" | "createdAt" | "stats"> & {
    stats?: AdCreative["stats"];
  },
): Promise<AdCreative> {
  const item: AdCreative = {
    ...input,
    id: `ad_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    stats: input.stats ? normalizeAdStats(input.stats) : emptyAdStats(),
  };
  await enqueueWrite((data) => {
    data.ads = data.ads ?? [];
    data.ads.unshift(item);
  });
  return item;
}

export async function updateAd(
  id: string,
  patch: Partial<Omit<AdCreative, "id" | "createdAt">>,
): Promise<AdCreative | null> {
  let updated: AdCreative | null = null;
  await enqueueWrite((data) => {
    const item = (data.ads ?? []).find((a) => a.id === id);
    if (!item) return;
    const { stats: _stats, ...rest } = patch;
    Object.assign(item, rest);
    if (patch.stats) item.stats = normalizeAdStats(patch.stats);
    if (!item.stats) item.stats = emptyAdStats();
    updated = { ...item, stats: { ...item.stats, daily: [...item.stats.daily] } };
  });
  return updated;
}

export async function removeAd(id: string): Promise<boolean> {
  let removed = false;
  await enqueueWrite((data) => {
    const before = (data.ads ?? []).length;
    data.ads = (data.ads ?? []).filter((a) => a.id !== id);
    removed = data.ads.length < before;
  });
  return removed;
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
  await enqueueWrite((data) => {
    data.ads = data.ads ?? [];
    for (const delta of deltas) {
      const item = data.ads.find((a) => a.id === delta.id);
      if (!item) continue;
      if (!item.stats) item.stats = emptyAdStats();
      const nowIso = new Date().toISOString();
      if (delta.impressions > 0) {
        item.stats.impressions += delta.impressions;
        item.stats.lastImpressionAt = nowIso;
      }
      if (delta.clicks > 0) {
        item.stats.clicks += delta.clicks;
        item.stats.lastClickAt = nowIso;
      }
      let daily = item.stats.daily.find((d) => d.date === day);
      if (!daily) {
        daily = { date: day, impressions: 0, clicks: 0 };
        item.stats.daily.push(daily);
      }
      daily.impressions += Math.max(0, delta.impressions);
      daily.clicks += Math.max(0, delta.clicks);
      item.stats.daily = item.stats.daily
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-keepDays);
    }
  });
}

export async function resetAdStats(id: string): Promise<AdCreative | null> {
  return updateAd(id, { stats: emptyAdStats() });
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
  await enqueueWrite((data) => {
    for (const delta of deltas) {
      const item = data.exchangers.find((e) => e.id === delta.id);
      if (!item) continue;
      if (!item.traffic) item.traffic = emptyExchangerTraffic();
      const nowIso = new Date().toISOString();
      if (delta.pageViews > 0) {
        item.traffic.pageViews += delta.pageViews;
        item.traffic.lastViewAt = nowIso;
      }
      if (delta.siteClicks > 0) {
        item.traffic.siteClicks += delta.siteClicks;
        item.traffic.lastClickAt = nowIso;
      }
      let daily = item.traffic.daily.find((d) => d.date === day);
      if (!daily) {
        daily = { date: day, pageViews: 0, siteClicks: 0 };
        item.traffic.daily.push(daily);
      }
      daily.pageViews += Math.max(0, delta.pageViews);
      daily.siteClicks += Math.max(0, delta.siteClicks);
      item.traffic.daily = item.traffic.daily
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-keepDays);
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
