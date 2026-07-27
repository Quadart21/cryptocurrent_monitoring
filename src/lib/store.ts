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
  AdPricingSettings,
  AdTariff,
  AdTariffPeriod,
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
  AdPricingSettings,
  AdTariff,
  AdTariffPeriod,
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
  adTariffs: AdTariff[];
  adPricing: AdPricingSettings;
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
    exchangerId: null,
  },
  {
    id: "b2",
    name: "TurboBit Exchange",
    reason: "Невыплата по подтверждённым заявкам, поддержка перестала отвечать.",
    reportedAt: "2026-03-28",
    reports: 31,
    exchangerId: null,
  },
  {
    id: "b3",
    name: "RubleRocket",
    reason: "Поддельные реквизиты и фишинговые зеркала официального сайта.",
    reportedAt: "2026-01-09",
    reports: 62,
    exchangerId: null,
  },
  {
    id: "b4",
    name: "ShadowPay Pro",
    reason: "Массовые жалобы на подмену курса после создания заявки.",
    reportedAt: "2025-11-17",
    reports: 24,
    exchangerId: null,
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
    ownerLogin: "kubex",
    ownerPasswordHash:
      "915bbe7d238199b20928beb910402f53991f2c7d229ec9a95bd03be2611bebcc",
  },
];

const seedAdPricing: AdPricingSettings = {
  contact: "ads@cryptomon.local",
  intro:
    "Разместите баннер или выделите обменник в мониторинге Cryptomon. Ниже — актуальные форматы, размеры и тарифы.",
  note: "Цены указаны в рублях. Слоты ограничены: при занятости даты согласуем отдельно.",
};

const seedAdTariffs: AdTariff[] = [
  {
    id: "tar_header",
    placement: "header",
    type: "banner",
    title: "Баннер под шапкой",
    description:
      "Горизонтальный баннер сразу под топбаром на всех публичных страницах.",
    sizeLabel: "1200×90",
    price: 25000,
    period: "week",
    currency: "RUB",
    features: [
      "Весь сайт",
      "Случайная ротация при нескольких креативах",
      "Статистика показов и кликов",
    ],
    active: true,
    sortOrder: 10,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tar_dashboard",
    placement: "dashboard",
    type: "banner",
    title: "Баннер над курсами",
    description: "Баннер на главной странице над таблицей предложений.",
    sizeLabel: "1200×120",
    price: 35000,
    period: "week",
    currency: "RUB",
    features: [
      "Главная страница",
      "Максимальный охват при выборе пары",
      "Статистика CTR",
    ],
    active: true,
    sortOrder: 20,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tar_footer",
    placement: "footer",
    type: "banner",
    title: "Баннер внизу страницы",
    description: "Крупный баннер в футере публичных страниц.",
    sizeLabel: "970×250",
    price: 18000,
    period: "week",
    currency: "RUB",
    features: ["Все публичные страницы", "Большой креатив", "Статистика"],
    active: true,
    sortOrder: 30,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tar_ticker",
    placement: "ticker",
    type: "ticker",
    title: "Бегущая строка",
    description: "Текстовая полоса под шапкой с ссылкой на ваш сайт.",
    sizeLabel: "текст до 120 символов",
    price: 12000,
    period: "week",
    currency: "RUB",
    features: ["Весь сайт", "Быстрый запуск без макета", "Ссылка на сайт"],
    active: true,
    sortOrder: 40,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tar_exchangers",
    placement: "exchangers",
    type: "highlight",
    title: "Выделение в списке обменников",
    description: "Подсветка карточки обменника на странице /exchangers.",
    sizeLabel: "без баннера",
    price: 15000,
    period: "week",
    currency: "RUB",
    features: [
      "Страница списка обменников",
      "Привязка к вашему обменнику",
      "Повышенная заметность",
    ],
    active: true,
    sortOrder: 50,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tar_rates",
    placement: "rates",
    type: "rates_pin",
    title: "Закреп в таблице курсов",
    description:
      "Ваш обменник поднимается в таблице курсов на главной при выбранной паре.",
    sizeLabel: "без баннера",
    price: 40000,
    period: "week",
    currency: "RUB",
    features: [
      "Главная · таблица курсов",
      "Закреп поверх органической сортировки",
      "Максимальная конверсия в переход",
    ],
    active: true,
    sortOrder: 60,
    updatedAt: new Date().toISOString(),
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
    adTariffs: structuredClone(seedAdTariffs),
    adPricing: structuredClone(seedAdPricing),
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

function normalizeAdTariff(raw: Partial<AdTariff> & { id: string }): AdTariff {
  const period: AdTariffPeriod =
    raw.period === "day" || raw.period === "week" || raw.period === "month"
      ? raw.period
      : "week";
  return {
    id: raw.id,
    placement: raw.placement ?? "dashboard",
    type: raw.type ?? "banner",
    title: typeof raw.title === "string" ? raw.title : raw.id,
    description: typeof raw.description === "string" ? raw.description : "",
    sizeLabel: typeof raw.sizeLabel === "string" ? raw.sizeLabel : "",
    price: typeof raw.price === "number" ? Math.max(0, raw.price) : 0,
    period,
    currency: "RUB",
    features: Array.isArray(raw.features)
      ? raw.features.filter((f): f is string => typeof f === "string")
      : [],
    active: raw.active !== false,
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 0,
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
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
    ownerLogin:
      typeof ex.ownerLogin === "string" && ex.ownerLogin.trim()
        ? ex.ownerLogin.trim().toLowerCase()
        : null,
    ownerPasswordHash:
      typeof ex.ownerPasswordHash === "string" && ex.ownerPasswordHash
        ? ex.ownerPasswordHash
        : null,
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
  const hadAdTariffs =
    Array.isArray(parsed.adTariffs) && parsed.adTariffs.length > 0;
  const hadAdPricing =
    parsed.adPricing != null && typeof parsed.adPricing === "object";

  const exchangers = (parsed.exchangers ?? []).map((ex) =>
    normalizeExchanger(ex),
  );

  let ownerCredsMigrated = false;
  for (const ex of exchangers) {
    if (ex.id === "kubex" && (!ex.ownerLogin || !ex.ownerPasswordHash)) {
      ex.ownerLogin = "kubex";
      ex.ownerPasswordHash =
        "915bbe7d238199b20928beb910402f53991f2c7d229ec9a95bd03be2611bebcc";
      ownerCredsMigrated = true;
    }
  }

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
      ? (parsed.blacklist ?? []).map((raw) => {
          const b = raw as Partial<BlacklistItem> & {
            id: string;
            name: string;
            reason: string;
          };
          return {
            id: b.id,
            name: b.name,
            reason: b.reason,
            reportedAt:
              typeof b.reportedAt === "string"
                ? b.reportedAt
                : new Date().toISOString().slice(0, 10),
            reports: typeof b.reports === "number" ? b.reports : 1,
            exchangerId:
              typeof b.exchangerId === "string" && b.exchangerId
                ? b.exchangerId
                : null,
          };
        })
      : structuredClone(seedBlacklist),
    qualityTags: hadTags
      ? parsed.qualityTags!
      : structuredClone(seedQualityTags),
    reviews: hadReviews
      ? (parsed.reviews ?? []).map((r) => ({
          ...r,
          ownerReply:
            typeof r.ownerReply === "string" ? r.ownerReply : null,
          ownerRepliedAt:
            typeof r.ownerRepliedAt === "string" ? r.ownerRepliedAt : null,
        }))
      : [],
    achievements: hadAchievements ? parsed.achievements! : [],
    ads,
    adTariffs: hadAdTariffs
      ? parsed.adTariffs!.map(normalizeAdTariff)
      : structuredClone(seedAdTariffs),
    adPricing: hadAdPricing
      ? {
          contact:
            typeof parsed.adPricing!.contact === "string"
              ? parsed.adPricing!.contact
              : seedAdPricing.contact,
          intro:
            typeof parsed.adPricing!.intro === "string"
              ? parsed.adPricing!.intro
              : seedAdPricing.intro,
          note:
            typeof parsed.adPricing!.note === "string"
              ? parsed.adPricing!.note
              : seedAdPricing.note,
        }
      : structuredClone(seedAdPricing),
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
  const blacklistNeedsId =
    hadBlacklist &&
    (parsed.blacklist ?? []).some(
      (b) => !("exchangerId" in (b as object)),
    );
  const migrated =
    !hadTags ||
    !hadReviews ||
    !hadBlacklist ||
    !hadAchievements ||
    !hadAds ||
    !hadAdTariffs ||
    !hadAdPricing ||
    adsNeedStats ||
    needsRepair ||
    ownerCredsMigrated ||
    blacklistNeedsId;
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
    adTariffs: data.adTariffs ?? [],
    adPricing: data.adPricing ?? structuredClone(seedAdPricing),
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
      (e) =>
        (e.status === "active" || e.status === "error") &&
        !isExchangerBlacklisted(e, store.blacklist),
    );
  }
  return store.exchangers;
}

export async function getExchangerBySlug(
  slug: string,
  options?: { publicOnly?: boolean },
): Promise<FeedExchanger | undefined> {
  const store = await ensureLoaded();
  const ex = store.exchangers.find((e) => e.slug === slug);
  if (!ex) return undefined;
  if (options?.publicOnly && isExchangerBlacklisted(ex, store.blacklist)) {
    return undefined;
  }
  return ex;
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
    store.exchangers
      .filter(
        (e) =>
          e.status === "active" && !isExchangerBlacklisted(e, store.blacklist),
      )
      .map((e) => e.id),
  );
  return store.rates.filter((r) => activeIds.has(r.exchangerId));
}

/** Match blacklist by linked id or by name (legacy free-text entries). */
export function isExchangerBlacklisted(
  ex: Pick<FeedExchanger, "id" | "name" | "slug">,
  blacklist: BlacklistItem[],
): boolean {
  const name = ex.name.trim().toLowerCase();
  const slug = ex.slug.trim().toLowerCase();
  return blacklist.some((b) => {
    if (b.exchangerId && b.exchangerId === ex.id) return true;
    const bn = b.name.trim().toLowerCase();
    return bn === name || bn === slug;
  });
}

export async function isSlugBlacklisted(slug: string): Promise<boolean> {
  const store = await ensureLoaded();
  const ex = store.exchangers.find((e) => e.slug === slug);
  if (ex) return isExchangerBlacklisted(ex, store.blacklist);
  const needle = slug.trim().toLowerCase();
  return store.blacklist.some((b) => b.name.trim().toLowerCase() === needle);
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
  ownerLogin: string;
  ownerPasswordHash: string;
}): Promise<FeedExchanger> {
  const slugBase = slugify(input.name);
  let slug = slugBase;
  let i = 2;
  const id =
    input.id ??
    `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const ownerLogin = input.ownerLogin.trim().toLowerCase();

  const created = await enqueueWrite((data) => {
    while (data.exchangers.some((e) => e.slug === slug)) {
      slug = `${slugBase}-${i++}`;
    }
    if (
      data.exchangers.some(
        (e) => e.ownerLogin && e.ownerLogin === ownerLogin,
      )
    ) {
      throw new Error("OWNER_LOGIN_TAKEN");
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
      ownerLogin,
      ownerPasswordHash: input.ownerPasswordHash,
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
  await replaceExchangerRatesBatch([
    { exchangerId, items, meta },
  ]);
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

  await enqueueWrite((data) => {
    for (const { exchangerId, items, meta } of updates) {
      const ex = data.exchangers.find((e) => e.id === exchangerId);
      if (!ex) continue;

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
  exchangerId?: string | null;
}): Promise<BlacklistItem> {
  const name = input.name.trim();
  const reason = input.reason.trim();
  const exchangerId = input.exchangerId?.trim() || null;

  const item: BlacklistItem = {
    id: `bl_${Date.now().toString(36)}`,
    name,
    reason,
    reportedAt: new Date().toISOString().slice(0, 10),
    reports: input.reports ?? 1,
    exchangerId,
  };

  await enqueueWrite((data) => {
    const dup = data.blacklist.some((b) => {
      if (exchangerId && b.exchangerId === exchangerId) return true;
      return b.name.trim().toLowerCase() === name.toLowerCase();
    });
    if (dup) {
      throw new Error("ALREADY_BLACKLISTED");
    }
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
    ownerReply: null,
    ownerRepliedAt: null,
  };

  await enqueueWrite((data) => {
    data.reviews = data.reviews ?? [];
    data.reviews.unshift(review);
  });

  return review;
}

export async function replyToReview(
  reviewId: string,
  exchangerId: string,
  reply: string,
): Promise<ExchangerReview | null> {
  const text = reply.trim();
  if (text.length < 2 || text.length > 2000) {
    throw new Error("Ответ должен быть от 2 до 2000 символов");
  }

  let updated: ExchangerReview | null = null;
  await enqueueWrite((data) => {
    const review = (data.reviews ?? []).find((r) => r.id === reviewId);
    if (!review || review.exchangerId !== exchangerId) return;
    if (review.status !== "approved") return;
    review.ownerReply = text;
    review.ownerRepliedAt = new Date().toISOString();
    updated = { ...review };
  });
  return updated;
}

export async function findExchangerByOwnerLogin(
  login: string,
): Promise<FeedExchanger | undefined> {
  const needle = login.trim().toLowerCase();
  if (!needle) return undefined;
  const store = await ensureLoaded();
  return store.exchangers.find((e) => e.ownerLogin === needle);
}

export async function setOwnerCredentials(
  id: string,
  input: { ownerLogin: string; ownerPasswordHash: string },
): Promise<FeedExchanger | null> {
  const ownerLogin = input.ownerLogin.trim().toLowerCase();
  let updated: FeedExchanger | null = null;

  await enqueueWrite((data) => {
    const ex = data.exchangers.find((e) => e.id === id);
    if (!ex) return;

    const taken = data.exchangers.some(
      (e) => e.id !== id && e.ownerLogin && e.ownerLogin === ownerLogin,
    );
    if (taken) {
      throw new Error("OWNER_LOGIN_TAKEN");
    }

    ex.ownerLogin = ownerLogin;
    ex.ownerPasswordHash = input.ownerPasswordHash;
    updated = { ...ex };
  });

  return updated;
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

export async function listAdTariffs(options?: {
  activeOnly?: boolean;
}): Promise<AdTariff[]> {
  const store = await ensureLoaded();
  let rows = [...(store.adTariffs ?? [])];
  if (options?.activeOnly) rows = rows.filter((t) => t.active);
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ru"));
}

export async function getAdPricing(): Promise<AdPricingSettings> {
  const store = await ensureLoaded();
  return store.adPricing ?? structuredClone(seedAdPricing);
}

export async function updateAdPricing(
  patch: Partial<AdPricingSettings>,
): Promise<AdPricingSettings> {
  let next = structuredClone(seedAdPricing);
  await enqueueWrite((data) => {
    data.adPricing = data.adPricing ?? structuredClone(seedAdPricing);
    if (typeof patch.contact === "string") {
      data.adPricing.contact = patch.contact.trim();
    }
    if (typeof patch.intro === "string") {
      data.adPricing.intro = patch.intro.trim();
    }
    if (typeof patch.note === "string") {
      data.adPricing.note = patch.note.trim();
    }
    next = { ...data.adPricing };
  });
  return next;
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
  let updated: AdTariff | null = null;
  await enqueueWrite((data) => {
    data.adTariffs = data.adTariffs ?? [];
    const item = data.adTariffs.find((t) => t.id === id);
    if (!item) return;
    if (typeof patch.title === "string" && patch.title.trim()) {
      item.title = patch.title.trim();
    }
    if (typeof patch.description === "string") {
      item.description = patch.description.trim();
    }
    if (typeof patch.sizeLabel === "string") {
      item.sizeLabel = patch.sizeLabel.trim();
    }
    if (typeof patch.price === "number" && Number.isFinite(patch.price)) {
      item.price = Math.max(0, patch.price);
    }
    if (
      patch.period === "day" ||
      patch.period === "week" ||
      patch.period === "month"
    ) {
      item.period = patch.period;
    }
    if (Array.isArray(patch.features)) {
      item.features = patch.features
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim())
        .filter(Boolean);
    }
    if (typeof patch.active === "boolean") item.active = patch.active;
    if (typeof patch.sortOrder === "number") item.sortOrder = patch.sortOrder;
    if (patch.placement) item.placement = patch.placement;
    if (patch.type) item.type = patch.type;
    item.updatedAt = new Date().toISOString();
    updated = { ...item };
  });
  return updated;
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
  await enqueueWrite((data) => {
    data.adTariffs = data.adTariffs ?? [];
    data.adTariffs.push(item);
  });
  return item;
}

export async function removeAdTariff(id: string): Promise<boolean> {
  let removed = false;
  await enqueueWrite((data) => {
    const before = (data.adTariffs ?? []).length;
    data.adTariffs = (data.adTariffs ?? []).filter((t) => t.id !== id);
    removed = data.adTariffs.length < before;
  });
  return removed;
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
