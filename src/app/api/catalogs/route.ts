import { NextResponse } from "next/server";
import {
  catalogMeta,
  listCities,
  listCountries,
  listCurrencies,
  listGroups,
} from "@/lib/bestchange/catalog";
import { ensureCatalogsHydrated } from "@/lib/bestchange/catalog-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureCatalogsHydrated();
  const meta = catalogMeta();

  return NextResponse.json({
    ...meta,
    groups: listGroups(),
    countries: listCountries(),
    cities: listCities(),
    currencies: listCurrencies(),
  });
}
