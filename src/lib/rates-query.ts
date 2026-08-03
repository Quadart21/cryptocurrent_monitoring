import "server-only";

import {
  getActiveRates,
  getLastGlobalSyncAt,
  listAchievements,
  listExchangers,
} from "@/lib/store";
import { logoPublicUrl } from "@/lib/logo-url";
import { currencyLabel, listCurrencies } from "@/lib/bestchange/catalog";
import { resolveCurrencyGroup } from "@/lib/bestchange/currency-groups";

export type RatesQueryInput = {
  from?: string;
  to?: string;
  city?: string;
  mode?: "online" | "cash";
};

export type RatesOffer = {
  id: string;
  from: string;
  to: string;
  rate: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  city: string | null;
  receive: number;
  syncedAt: string;
  rank: number;
  exchanger: {
    id: string;
    slug: string;
    name: string;
    website: string;
    exchangeUrlTemplate: string;
    referralUrlTemplate: string;
    rating: number;
    reviews: number;
    verified: boolean;
    logoUrl: string | null;
    achievements: Array<{
      id: string;
      name: string;
      description: string;
      svg: string;
    }>;
    status: "online" | "offline";
    lastSyncAt: string | null;
    lastError: string | null;
  };
};

export type RatesQueryResult = {
  lastGlobalSyncAt: string | null;
  activePairCount: number;
  mode: "online" | "cash";
  city: string | null;
  currencies: Array<{ code: string; name: string }>;
  offers: RatesOffer[];
};

function cityMatches(
  rateCity: string | undefined,
  selectedCity: string,
): boolean {
  if (!selectedCity) return true;
  if (!rateCity) return false;
  const wanted = selectedCity.toUpperCase();
  return rateCity
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .includes(wanted);
}

export async function queryRates(
  input: RatesQueryInput = {},
): Promise<RatesQueryResult> {
  const from = (input.from ?? "").toUpperCase();
  const to = (input.to ?? "").toUpperCase();
  const city = (input.city ?? "").toUpperCase();
  const mode = input.mode === "cash" ? "cash" : "online";

  const [lastGlobalSyncAt, rates, exchangers, achievements] = await Promise.all([
    getLastGlobalSyncAt(),
    getActiveRates(),
    listExchangers({ publicOnly: true }),
    listAchievements(),
  ]);

  const byId = new Map(exchangers.map((e) => [e.id, e]));
  const achievementsById = new Map(achievements.map((a) => [a.id, a]));

  let filtered = rates;
  if (from && to) {
    filtered = rates.filter((r) => r.from === from && r.to === to);
  }
  if (mode === "cash" && city) {
    filtered = filtered.filter((r) => cityMatches(r.city, city));
  }

  const offers = filtered
    .map((rate) => {
      const exchanger = byId.get(rate.exchangerId);
      if (!exchanger || exchanger.status !== "active") return null;

      const achievements = (exchanger.achievementIds ?? [])
        .map((id) => achievementsById.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          svg: a.svg,
        }));

      return {
        id: rate.id,
        from: rate.from,
        to: rate.to,
        rate: rate.rate,
        reserve: rate.reserve,
        minAmount: rate.minAmount,
        maxAmount: rate.maxAmount,
        city: rate.city ?? null,
        receive: rate.rate,
        syncedAt: rate.syncedAt,
        exchanger: {
          id: exchanger.id,
          slug: exchanger.slug,
          name: exchanger.name,
          website: exchanger.website,
          exchangeUrlTemplate: exchanger.exchangeUrlTemplate,
          referralUrlTemplate: exchanger.referralUrlTemplate,
          rating: exchanger.rating,
          reviews: exchanger.reviews,
          verified: exchanger.verified,
          logoUrl: logoPublicUrl(exchanger.id, exchanger.logo),
          achievements,
          status:
            exchanger.status === "active"
              ? ("online" as const)
              : ("offline" as const),
          lastSyncAt: exchanger.lastSyncAt,
          lastError: exchanger.lastError,
        },
      };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)
    .sort((a, b) => {
      if (b.rate !== a.rate) return b.rate - a.rate;
      if (b.exchanger.rating !== a.exchanger.rating) {
        return b.exchanger.rating - a.exchanger.rating;
      }
      return a.exchanger.name.localeCompare(b.exchanger.name, "ru");
    })
    .map((offer, index) => ({ ...offer, rank: index + 1 }));

  const activePairCount = new Set(rates.map((r) => `${r.from}:${r.to}`)).size;

  return {
    lastGlobalSyncAt,
    activePairCount,
    mode,
    city: city || null,
    currencies: listCurrencies(
      mode === "online" ? { cash: false } : undefined,
    ).map((c) => {
      const group = resolveCurrencyGroup({
        code: c.code,
        groupId: c.groupId,
      });
      return {
        code: c.code,
        name: c.name || currencyLabel(c.code),
        groupId: group.groupId,
        groupName: group.groupName,
      };
    }),
    offers,
  };
}
