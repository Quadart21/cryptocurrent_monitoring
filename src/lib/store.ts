import { promises as fs } from "fs";
import path from "path";
import type { ParsedRateItem } from "@/lib/xml/parse-rates";
import type {
  BlacklistItem,
  FeedExchanger,
  FeedExchangerStatus,
} from "@/lib/store-types";

export type {
  BlacklistItem,
  FeedExchanger,
  FeedExchangerStatus,
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
    rating: 4.8,
    reviews: 120,
    ageYears: 3,
    createdAt: new Date().toISOString(),
    lastSyncAt: null,
    lastError: null,
    pairCount: 0,
  },
];

function emptyStore(): StoreData {
  return {
    exchangers: structuredClone(seedExchangers),
    rates: [],
    blacklist: structuredClone(seedBlacklist),
    lastGlobalSyncAt: null,
  };
}

let memory: StoreData | null = null;
let loadPromise: Promise<StoreData> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureLoaded(): Promise<StoreData> {
  if (memory) return memory;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const raw = await fs.readFile(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw) as StoreData;
      if (!parsed.exchangers?.length) {
        memory = emptyStore();
        await persist(memory);
      } else {
        memory = {
          ...parsed,
          blacklist: parsed.blacklist?.length
            ? parsed.blacklist
            : structuredClone(seedBlacklist),
          rates: parsed.rates ?? [],
          lastGlobalSyncAt: parsed.lastGlobalSyncAt ?? null,
        };
      }
    } catch {
      memory = emptyStore();
      await persist(memory);
    }
    return memory!;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

async function persist(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, STORE_PATH);
}

function enqueueWrite(mutator: (data: StoreData) => void): Promise<StoreData> {
  const run = writeQueue.then(async () => {
    const data = await ensureLoaded();
    mutator(data);
    memory = data;
    await persist(data);
    return data;
  });
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
  name: string;
  website: string;
  feedUrl: string;
  contact: string;
  description: string;
  pairCount: number;
}): Promise<FeedExchanger> {
  const slugBase = slugify(input.name);
  let slug = slugBase;
  let i = 2;

  const created = await enqueueWrite((data) => {
    while (data.exchangers.some((e) => e.slug === slug)) {
      slug = `${slugBase}-${i++}`;
    }

    const exchanger: FeedExchanger = {
      id: `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      slug,
      name: input.name,
      website: input.website,
      feedUrl: input.feedUrl,
      contact: input.contact,
      description: input.description,
      status: "pending",
      verified: false,
      rating: 4.5,
      reviews: 0,
      ageYears: 1,
      createdAt: new Date().toISOString(),
      lastSyncAt: null,
      lastError: null,
      pairCount: input.pairCount,
    };

    data.exchangers.push(exchanger);
  });

  return created.exchangers.find((e) => e.slug === slug)!;
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
      | "rating"
      | "reviews"
    >
  >,
): Promise<FeedExchanger | null> {
  let updated: FeedExchanger | null = null;
  await enqueueWrite((data) => {
    const ex = data.exchangers.find((e) => e.id === id);
    if (!ex) return;
    Object.assign(ex, patch);
    if (patch.status && patch.status !== "active") {
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
    removed = data.exchangers.length < before;
  });
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
