import { NextResponse } from "next/server";
import {
  currencyLabel,
  listCurrencies,
} from "@/lib/bestchange/catalog";
import {
  POPULAR_CASH_PAIRS,
  POPULAR_FEED_PAIRS,
} from "@/lib/bestchange/popular-pairs";
import { listExchangers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function norm(s: string) {
  return s.trim().toLocaleLowerCase("ru-RU");
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({
      exchangers: [],
      currencies: [],
      pairs: [],
    });
  }

  const needle = norm(q);
  const exchangers = await listExchangers({ publicOnly: true });

  const matchedExchangers = exchangers
    .filter(
      (e) =>
        norm(e.name).includes(needle) ||
        norm(e.slug).includes(needle) ||
        norm(e.website).includes(needle),
    )
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      rating: e.rating,
      status: e.status,
    }));

  const matchedCurrencies = listCurrencies()
    .filter((c) => {
      const code = norm(c.code);
      const name = norm(c.name || c.viewname || "");
      return code.includes(needle) || name.includes(needle);
    })
    .slice(0, 8)
    .map((c) => ({
      code: c.code,
      name: c.name || currencyLabel(c.code),
      cash: c.cash,
    }));

  const allPairs = [...POPULAR_FEED_PAIRS, ...POPULAR_CASH_PAIRS];
  const matchedPairs = allPairs
    .filter(([a, b]) => {
      const label = `${a} ${b} ${a}→${b}`.toLowerCase();
      return (
        label.includes(needle) ||
        norm(a).includes(needle) ||
        norm(b).includes(needle)
      );
    })
    .slice(0, 6)
    .map(([from, to]) => ({
      from,
      to,
      mode: from.startsWith("CASH") || to.startsWith("CASH") ? "cash" : "online",
      label: `${from} → ${to}`,
    }));

  return NextResponse.json({
    exchangers: matchedExchangers,
    currencies: matchedCurrencies,
    pairs: matchedPairs,
  });
}
