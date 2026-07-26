import { NextResponse } from "next/server";
import {
  getActiveRates,
  getStore,
  listExchangers,
} from "@/lib/store";
import { currencyLabel, listCurrencies } from "@/lib/bestchange/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.toUpperCase() ?? "";
  const to = searchParams.get("to")?.toUpperCase() ?? "";

  const [store, rates, exchangers] = await Promise.all([
    getStore(),
    getActiveRates(),
    listExchangers(),
  ]);

  const byId = new Map(exchangers.map((e) => [e.id, e]));

  let filtered = rates;
  if (from && to) {
    filtered = rates.filter((r) => r.from === from && r.to === to);
  }

  const offers = filtered
    .map((rate) => {
      const exchanger = byId.get(rate.exchangerId);
      if (!exchanger || exchanger.status !== "active") return null;

      return {
        id: rate.id,
        from: rate.from,
        to: rate.to,
        rate: rate.rate,
        reserve: rate.reserve,
        minAmount: rate.minAmount,
        maxAmount: rate.maxAmount,
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
    .sort(
      (a, b) =>
        b.rate - a.rate || b.exchanger.rating - a.exchanger.rating,
    )
    .map((offer, index) => ({ ...offer, rank: index + 1 }));

  const activePairCount = new Set(rates.map((r) => `${r.from}:${r.to}`)).size;

  return NextResponse.json({
    lastGlobalSyncAt: store.lastGlobalSyncAt,
    activePairCount,
    currencies: listCurrencies().map((c) => ({
      code: c.code,
      name: c.name || currencyLabel(c.code),
    })),
    offers,
  });
}
