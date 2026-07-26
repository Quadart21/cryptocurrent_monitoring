import { NextResponse } from "next/server";
import {
  getActiveRates,
  getStore,
  listExchangers,
} from "@/lib/store";
import { logoPublicUrl } from "@/lib/logo-url";
import { currencyLabel, listCurrencies } from "@/lib/bestchange/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.toUpperCase() ?? "";
  const to = searchParams.get("to")?.toUpperCase() ?? "";
  const city = searchParams.get("city")?.toUpperCase() ?? "";
  const mode = searchParams.get("mode") === "cash" ? "cash" : "online";

  const [store, rates, exchangers] = await Promise.all([
    getStore(),
    getActiveRates(),
    listExchangers(),
  ]);

  const byId = new Map(exchangers.map((e) => [e.id, e]));
  const achievementsById = new Map(
    (store.achievements ?? []).map((a) => [a.id, a]),
  );

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
    // Самый выгодный курс сверху: больше единиц `to` за 1 `from`.
    .sort((a, b) => {
      if (b.rate !== a.rate) return b.rate - a.rate;
      if (b.exchanger.rating !== a.exchanger.rating) {
        return b.exchanger.rating - a.exchanger.rating;
      }
      return a.exchanger.name.localeCompare(b.exchanger.name, "ru");
    })
    .map((offer, index) => ({ ...offer, rank: index + 1 }));

  const activePairCount = new Set(rates.map((r) => `${r.from}:${r.to}`)).size;

  return NextResponse.json({
    lastGlobalSyncAt: store.lastGlobalSyncAt,
    activePairCount,
    mode,
    city: city || null,
    currencies: listCurrencies(
      mode === "online" ? { cash: false } : undefined,
    ).map((c) => ({
      code: c.code,
      name: c.name || currencyLabel(c.code),
    })),
    offers,
  });
}
