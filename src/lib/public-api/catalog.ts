import "server-only";

import {
  ensureCatalogsHydrated,
  getCatalogSnapshot,
} from "@/lib/bestchange/catalog-store";
import {
  listCities,
  listCountries,
  listCurrencies,
  listGroups,
} from "@/lib/bestchange/catalog";
import { getActiveRates, getSeoSettings, listExchangers } from "@/lib/store";
import { siteBaseUrl } from "@/lib/email/service";
import type {
  ApiChanger,
  ApiCity,
  ApiCountry,
  ApiCurrency,
  ApiExchangeRate,
  ApiGroup,
  ApiPresence,
} from "@/lib/public-api/types";

export function normalizeLang(lang: string | undefined): "ru" | "en" {
  const l = (lang ?? "ru").trim().toLowerCase();
  return l === "en" ? "en" : "ru";
}

function pickName(ru: string, en: string, lang: "ru" | "en"): string {
  if (lang === "en") return en || ru;
  return ru || en;
}

export async function apiLangs() {
  return { langs: ["en", "ru"] };
}

export async function apiGroups(langRaw: string) {
  await ensureCatalogsHydrated();
  const lang = normalizeLang(langRaw);
  const groups: ApiGroup[] = listGroups().map((g) => ({
    id: g.id,
    name: pickName(g.name, g.nameEn, lang),
  }));
  return { groups };
}

export async function apiCountries(langRaw: string) {
  await ensureCatalogsHydrated();
  const lang = normalizeLang(langRaw);
  const countries: ApiCountry[] = listCountries().map((c) => ({
    id: c.id,
    name: pickName(c.name, c.nameEn, lang),
    code: c.code,
  }));
  return { countries };
}

export async function apiCities(langRaw: string) {
  await ensureCatalogsHydrated();
  const lang = normalizeLang(langRaw);
  const cities: ApiCity[] = listCities().map((c) => ({
    id: c.id,
    name: pickName(c.name, c.nameEn, lang),
    code: c.code,
    country: c.countryId ?? 0,
  }));
  return { cities };
}

export async function apiCurrencies(langRaw: string) {
  await ensureCatalogsHydrated();
  const lang = normalizeLang(langRaw);
  const currencies: ApiCurrency[] = listCurrencies().map((c) => ({
    id: c.id,
    name: pickName(c.name, c.nameEn, lang),
    urlname: c.urlname || c.code.toLowerCase(),
    viewname: c.viewname || c.code,
    code: c.code,
    crypto: c.crypto,
    cash: c.cash,
    ps: c.ps ?? 0,
    group: c.groupId,
  }));
  return { currencies };
}

export async function apiChangers(langRaw: string) {
  await ensureCatalogsHydrated();
  const lang = normalizeLang(langRaw);
  void lang;
  const [exchangers, seo, activeRates] = await Promise.all([
    listExchangers(),
    getSeoSettings(),
    getActiveRates(),
  ]);
  const base = siteBaseUrl(seo.siteUrl);

  const reserveByEx = new Map<string, number>();
  for (const r of activeRates) {
    reserveByEx.set(
      r.exchangerId,
      (reserveByEx.get(r.exchangerId) ?? 0) + (r.reserve || 0),
    );
  }

  const changers: ApiChanger[] = exchangers
    .filter((e) => e.apiId != null)
    .map((e) => {
      const page = `${base}/exchangers/${e.slug}`;
      const site = e.website || page;
      return {
        id: e.apiId!,
        name: e.name,
        langs: ["en", "ru"],
        urls: { en: site, ru: site },
        pages: { en: page, ru: page },
        reserve: Math.round(reserveByEx.get(e.id) ?? 0),
        reviews: {
          claim: e.reviewsNegative,
          closed: 0,
          neutral: 0,
          positive: e.reviewsPositive,
        },
        rating: Math.max(0, Math.min(5, Math.round(e.rating))),
        active: e.status === "active",
      };
    })
    .sort((a, b) => a.id - b.id);

  return { changers };
}

export type ParsedPair = {
  fromId: number;
  toId: number;
  cityId: number | null;
  key: string;
};

/** Parse path segment: `305-89`, `305-89-1`, or batch `305-89+31-12`. */
export function parsePairList(raw: string): ParsedPair[] {
  const decoded = decodeURIComponent(raw).replace(/\s+/g, "+");
  const parts = decoded
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 500) {
    throw new Error("PAIR_LIMIT");
  }
  const out: ParsedPair[] = [];
  for (const part of parts) {
    const nums = part.split("-").map((n) => Number(n));
    if (nums.length < 2 || nums.length > 3) continue;
    const fromId = nums[0]!;
    const toId = nums[1]!;
    const cityId = nums.length === 3 ? nums[2]! : null;
    if (![fromId, toId, cityId ?? 0].every((n) => Number.isFinite(n) && n >= 0)) {
      continue;
    }
    const key =
      cityId != null ? `${fromId}-${toId}-${cityId}` : `${fromId}-${toId}`;
    out.push({ fromId, toId, cityId, key });
  }
  return out;
}

function buildIdMaps() {
  const snap = getCatalogSnapshot();
  const currencyById = new Map<number, string>();
  const currencyIdByCode = new Map<string, number>();
  for (const c of Object.values(snap.currencies)) {
    currencyById.set(c.id, c.code);
    currencyIdByCode.set(c.code.toUpperCase(), c.id);
  }
  const cityById = new Map<number, string>();
  const cityIdByCode = new Map<string, number>();
  for (const c of Object.values(snap.cities)) {
    cityById.set(c.id, c.code);
    cityIdByCode.set(c.code.toUpperCase(), c.id);
  }
  return { currencyById, currencyIdByCode, cityById, cityIdByCode };
}

function cityMatches(rateCity: string | undefined, wantedCode: string): boolean {
  if (!wantedCode) return true;
  if (!rateCity) return false;
  const wanted = wantedCode.toUpperCase();
  return rateCity
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
    .includes(wanted);
}

function parseMarks(param: string | undefined): string[] {
  if (!param) return [];
  const known = new Set([
    "card2card",
    "cardverify",
    "delay",
    "delivery",
    "floating",
    "manual",
    "more",
    "official",
    "otherin",
    "otherout",
    "percent",
    "purse",
    "reg",
    "unstable",
    "verifying",
    "atm",
    "language",
  ]);
  return param
    .split(/[,;\s]+/)
    .map((m) => m.trim().toLowerCase())
    .filter((m) => known.has(m));
}

export async function apiRates(pairRaw: string): Promise<{
  rates: Record<string, ApiExchangeRate[]>;
}> {
  await ensureCatalogsHydrated();
  const pairs = parsePairList(pairRaw);
  if (!pairs.length) {
    return { rates: {} };
  }

  const { currencyById, cityById } = buildIdMaps();
  const [activeRates, exchangers] = await Promise.all([
    getActiveRates(),
    listExchangers(),
  ]);

  const changerIdByEx = new Map<string, number>();
  for (const e of exchangers) {
    if (e.apiId != null && (e.status === "active" || e.status === "error")) {
      changerIdByEx.set(e.id, e.apiId);
    }
  }

  const ratesOut: Record<string, ApiExchangeRate[]> = {};

  for (const pair of pairs) {
    const fromCode = currencyById.get(pair.fromId);
    const toCode = currencyById.get(pair.toId);
    if (!fromCode || !toCode) {
      ratesOut[pair.key] = [];
      continue;
    }
    const cityCode =
      pair.cityId != null ? cityById.get(pair.cityId) ?? null : null;
    if (pair.cityId != null && !cityCode) {
      ratesOut[pair.key] = [];
      continue;
    }

    const offers: ApiExchangeRate[] = [];
    for (const r of activeRates) {
      if (r.from.toUpperCase() !== fromCode.toUpperCase()) continue;
      if (r.to.toUpperCase() !== toCode.toUpperCase()) continue;
      if (cityCode) {
        if (!cityMatches(r.city, cityCode)) continue;
      } else if (r.city) {
        // Online pair request: skip cash-city-specific rows when no city asked
        // Keep rows without city (online) — cash rows with city only when cityId set
        continue;
      }
      const changer = changerIdByEx.get(r.exchangerId);
      if (changer == null) continue;
      offers.push({
        changer,
        rate: r.rate,
        rankrate: String(r.rate),
        reserve: String(r.reserve ?? 0),
        inmin: String(r.minAmount ?? 0),
        inmax: String(r.maxAmount ?? 0),
        marks: parseMarks(r.param),
      });
    }
    offers.sort((a, b) => Number(b.rate) - Number(a.rate));
    ratesOut[pair.key] = offers;
  }

  return { rates: ratesOut };
}

export async function apiPresences(pairRaw: string): Promise<{
  presences: ApiPresence[];
}> {
  const { rates } = await apiRates(pairRaw);
  const pairs = parsePairList(pairRaw);
  const presences: ApiPresence[] = pairs.map((p) => {
    const list = rates[p.key] ?? [];
    const best = list.length ? Number(list[0]!.rate) : 0;
    return {
      pair: `${p.fromId}-${p.toId}`,
      best,
      count: list.length,
    };
  });
  return { presences };
}
