import type { AdCreative, AdPlacement, AdType } from "@/lib/store-types";

export const AD_TYPE_LABELS: Record<AdType, string> = {
  banner: "Баннер",
  ticker: "Бегущая строка",
  highlight: "Выделение в списке",
  rates_pin: "Закреп в курсах",
};

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  header: "Под шапкой (весь сайт)",
  ticker: "Бегущая строка",
  dashboard: "Над таблицей курсов",
  home_mid: "Главная — между курсами и новостями",
  pair_after: "Страница пары — после курсов",
  exchanger_page: "Карточка обменника",
  footer: "Низ страницы",
  exchangers: "Список обменников",
  rates: "Таблица курсов",
};

/** Где пользователь увидит слот (не в /trulala) */
export const AD_PLACEMENT_HINTS: Record<AdPlacement, string> = {
  header: "Публичные страницы, сразу под топбаром",
  ticker: "Публичные страницы, полоса под топбаром (в админке не видно)",
  dashboard: "Главная (/), над таблицей курсов",
  home_mid: "Главная (/), между таблицей курсов и блоком новостей",
  pair_after: "Страницы /rates/…, после таблицы курсов, до FAQ",
  exchanger_page: "Страницы /exchangers/…, между SEO-блоками и отзывами",
  footer: "Публичные страницы, внизу контента",
  exchangers: "Страница /exchangers",
  rates: "Главная и страницы пар — закреп в таблице курсов (везде или выбранные пары)",
};

/** Рекомендуемые размеры image-баннеров */
export const BANNER_SPECS: Partial<
  Record<
    AdPlacement,
    {
      sizeLabel: string;
      width: number;
      height: number;
      aspectClass: string;
      maxHeightClass: string;
    }
  >
> = {
  header: {
    sizeLabel: "1200×90",
    width: 1200,
    height: 90,
    aspectClass: "aspect-[1200/90]",
    maxHeightClass: "max-h-[90px]",
  },
  dashboard: {
    sizeLabel: "1200×120",
    width: 1200,
    height: 120,
    aspectClass: "aspect-[1200/120]",
    maxHeightClass: "max-h-[120px]",
  },
  home_mid: {
    sizeLabel: "1200×120",
    width: 1200,
    height: 120,
    aspectClass: "aspect-[1200/120]",
    maxHeightClass: "max-h-[120px]",
  },
  pair_after: {
    sizeLabel: "1200×90",
    width: 1200,
    height: 90,
    aspectClass: "aspect-[1200/90]",
    maxHeightClass: "max-h-[90px]",
  },
  exchanger_page: {
    sizeLabel: "1200×90",
    width: 1200,
    height: 90,
    aspectClass: "aspect-[1200/90]",
    maxHeightClass: "max-h-[90px]",
  },
  footer: {
    sizeLabel: "970×250",
    width: 970,
    height: 250,
    aspectClass: "aspect-[970/250]",
    maxHeightClass: "max-h-[250px]",
  },
};

/** Какие placement допустимы для типа */
export const AD_TYPE_PLACEMENTS: Record<AdType, AdPlacement[]> = {
  banner: [
    "header",
    "dashboard",
    "home_mid",
    "pair_after",
    "exchanger_page",
    "footer",
  ],
  ticker: ["ticker"],
  highlight: ["exchangers"],
  rates_pin: ["rates"],
};

export function isAdLive(ad: AdCreative, now = Date.now()): boolean {
  if (!ad.active) return false;
  if (ad.startsAt) {
    const t = Date.parse(ad.startsAt);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (ad.endsAt) {
    const t = Date.parse(ad.endsAt);
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

export function sortAds(ads: AdCreative[]): AdCreative[] {
  return [...ads].sort(
    (a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt),
  );
}

export function emptyAdStats(): AdCreative["stats"] {
  return {
    impressions: 0,
    clicks: 0,
    lastImpressionAt: null,
    lastClickAt: null,
    daily: [],
  };
}

export function normalizeAdStats(
  raw: Partial<AdCreative["stats"]> | null | undefined,
): AdCreative["stats"] {
  const daily = Array.isArray(raw?.daily)
    ? raw!.daily
        .filter(
          (d) =>
            d &&
            typeof d.date === "string" &&
            typeof d.impressions === "number" &&
            typeof d.clicks === "number",
        )
        .map((d) => ({
          date: d.date,
          impressions: Math.max(0, d.impressions),
          clicks: Math.max(0, d.clicks),
        }))
    : [];
  return {
    impressions: Math.max(0, Number(raw?.impressions) || 0),
    clicks: Math.max(0, Number(raw?.clicks) || 0),
    lastImpressionAt:
      typeof raw?.lastImpressionAt === "string" ? raw.lastImpressionAt : null,
    lastClickAt: typeof raw?.lastClickAt === "string" ? raw.lastClickAt : null,
    daily,
  };
}

/** CTR в процентах (0–100), null если не было показов */
export function adCtrPercent(stats: { impressions: number; clicks: number }) {
  if (stats.impressions <= 0) return null;
  return Math.round((stats.clicks / stats.impressions) * 10000) / 100;
}

export function formatCtr(stats: { impressions: number; clicks: number }) {
  const ctr = adCtrPercent(stats);
  return ctr === null ? "—" : `${ctr.toFixed(2)}%`;
}

/** Случайный выбор с весом по priority (минимум 1) */
export function pickWeightedRandom<T extends { priority: number }>(
  items: T[],
): T | null {
  if (!items.length) return null;
  const weights = items.map((item) => Math.max(1, Number(item.priority) || 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    cursor -= weights[i]!;
    if (cursor <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

export function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

export const AD_PERIOD_LABELS: Record<"day" | "week" | "month", string> = {
  day: "сутки",
  week: "неделя",
  month: "месяц",
};

export function formatAdPrice(price: number, currency: "RUB" = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Ключ пары для ads.pairs: `BTC:RUB` */
export function adPairKey(from: string, to: string): string {
  return `${from.trim().toUpperCase()}:${to.trim().toUpperCase()}`;
}

export function parseAdPairKey(
  key: string,
): { from: string; to: string } | null {
  const raw = String(key ?? "").trim().toUpperCase();
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const from = raw.slice(0, idx);
  const to = raw.slice(idx + 1);
  if (!/^[A-Z0-9]+$/.test(from) || !/^[A-Z0-9]+$/.test(to)) return null;
  return { from, to };
}

/** Пустой список = везде; иначе только перечисленные пары. */
export function normalizeAdPairs(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string" && raw.trim()
      ? raw.split(/[\s,;]+/)
      : [];
  const keys = new Set<string>();
  for (const item of list) {
    const parsed = parseAdPairKey(String(item));
    if (parsed) keys.add(adPairKey(parsed.from, parsed.to));
  }
  return [...keys].sort();
}

export function adMatchesPair(
  ad: { pairs?: string[] | null },
  from: string,
  to: string,
): boolean {
  const pairs = ad.pairs ?? [];
  if (!pairs.length) return true;
  return pairs.includes(adPairKey(from, to));
}
