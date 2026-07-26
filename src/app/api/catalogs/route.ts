import { NextResponse } from "next/server";
import catalogs from "@/data/bestchange/catalogs.json";
import {
  catalogMeta,
  listCities,
  listCountries,
  listCurrencies,
  listGroups,
} from "@/lib/bestchange/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const full = searchParams.get("full") === "1";
  const meta = catalogMeta();

  if (!full) {
    return NextResponse.json({
      ...meta,
      groups: listGroups(),
      countries: listCountries(),
      cities: listCities(),
      currencies: listCurrencies(),
    });
  }

  return NextResponse.json(catalogs);
}
