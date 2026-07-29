import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { pathToFileURL } from "url";
import path from "path";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import { catalogProposals } from "@/db/schema";
import {
  ensureCatalogsHydrated,
  getCatalogSnapshot,
  upsertCity,
  upsertCountry,
  upsertCurrency,
  type CatalogSnapshot,
} from "@/lib/bestchange/catalog-store";
import type {
  BcCity,
  BcCountry,
  BcCurrency,
} from "@/lib/bestchange/catalog-types";

export type CatalogProposalKind = "currency" | "city" | "country";
export type CatalogProposalStatus = "pending" | "approved" | "rejected";

export type CatalogProposal = {
  id: string;
  kind: CatalogProposalKind;
  code: string;
  name: string;
  payload: Record<string, unknown>;
  status: CatalogProposalStatus;
  discoveredAt: string;
  moderatedAt: string | null;
};

function mapProposal(
  row: typeof catalogProposals.$inferSelect,
): CatalogProposal {
  return {
    id: row.id,
    kind: row.kind as CatalogProposalKind,
    code: row.code,
    name: row.name,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: row.status as CatalogProposalStatus,
    discoveredAt: row.discoveredAt,
    moderatedAt: row.moderatedAt,
  };
}

export async function listCatalogProposals(
  status: CatalogProposalStatus | "all" = "pending",
): Promise<CatalogProposal[]> {
  await runMigrations();
  const db = getDb();
  const rows =
    status === "all"
      ? await db.select().from(catalogProposals)
      : await db
          .select()
          .from(catalogProposals)
          .where(eq(catalogProposals.status, status));
  return rows
    .map(mapProposal)
    .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
}

export async function countPendingCatalogProposals(): Promise<number> {
  await runMigrations();
  const db = getDb();
  const rows = await db
    .select({ id: catalogProposals.id })
    .from(catalogProposals)
    .where(eq(catalogProposals.status, "pending"));
  return rows.length;
}

type RemoteCatalogPayload = {
  catalogs: { fetchedAt: string; counts: CatalogSnapshot["counts"] };
  currencyByCode: Record<string, BcCurrency>;
  cityByCode: Record<string, BcCity>;
  countryByCode: Record<string, BcCountry>;
};

/** Bypass Next/Turbopack static analysis for a runtime file:// import. */
const importRuntime = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<{
  buildCatalogPayloadFromApi: () => Promise<RemoteCatalogPayload>;
}>;

async function loadRemotePayload(): Promise<RemoteCatalogPayload> {
  const scriptUrl = pathToFileURL(
    path.join(process.cwd(), "scripts", "lib", "bestchange-catalogs.mjs"),
  ).href;
  const mod = await importRuntime(scriptUrl);
  return mod.buildCatalogPayloadFromApi();
}

async function knownProposalKeys(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({
      kind: catalogProposals.kind,
      code: catalogProposals.code,
      status: catalogProposals.status,
    })
    .from(catalogProposals)
    .where(inArray(catalogProposals.status, ["pending", "rejected", "approved"]));
  return new Set(rows.map((r) => `${r.kind}:${r.code}`));
}

/**
 * Poll external catalog API and queue NEW codes for admin moderation.
 * Does NOT update the live catalog automatically.
 */
export async function discoverCatalogProposals(): Promise<{
  fetchedAt: string;
  remoteCounts: CatalogSnapshot["counts"];
  newCurrencies: number;
  newCities: number;
  newCountries: number;
  pendingTotal: number;
}> {
  await runMigrations();
  await ensureCatalogsHydrated();
  if (!process.env.BESTCHANGE_API_KEY?.trim()) {
    throw new Error("BESTCHANGE_API_KEY не задан");
  }

  const remote = await loadRemotePayload();
  const local = getCatalogSnapshot();
  const already = await knownProposalKeys();
  const db = getDb();
  const now = new Date().toISOString();

  let newCurrencies = 0;
  let newCities = 0;
  let newCountries = 0;

  for (const [code, item] of Object.entries(remote.currencyByCode)) {
    if (local.currencies[code]) continue;
    const key = `currency:${code}`;
    if (already.has(key)) continue;
    await db.insert(catalogProposals).values({
      id: `cp_cur_${code}_${Math.random().toString(36).slice(2, 8)}`,
      kind: "currency",
      code,
      name: item.name || item.viewname || code,
      payload: item as unknown as Record<string, unknown>,
      status: "pending",
      discoveredAt: now,
      moderatedAt: null,
    });
    already.add(key);
    newCurrencies += 1;
  }

  for (const [code, item] of Object.entries(remote.cityByCode)) {
    if (local.cities[code]) continue;
    const key = `city:${code}`;
    if (already.has(key)) continue;
    await db.insert(catalogProposals).values({
      id: `cp_city_${code}_${Math.random().toString(36).slice(2, 8)}`,
      kind: "city",
      code,
      name: item.name || code,
      payload: item as unknown as Record<string, unknown>,
      status: "pending",
      discoveredAt: now,
      moderatedAt: null,
    });
    already.add(key);
    newCities += 1;
  }

  for (const [code, item] of Object.entries(remote.countryByCode)) {
    if (local.countries[code]) continue;
    const key = `country:${code}`;
    if (already.has(key)) continue;
    await db.insert(catalogProposals).values({
      id: `cp_cty_${code}_${Math.random().toString(36).slice(2, 8)}`,
      kind: "country",
      code,
      name: item.name || code,
      payload: item as unknown as Record<string, unknown>,
      status: "pending",
      discoveredAt: now,
      moderatedAt: null,
    });
    already.add(key);
    newCountries += 1;
  }

  const pendingTotal = await countPendingCatalogProposals();
  return {
    fetchedAt: remote.catalogs.fetchedAt,
    remoteCounts: remote.catalogs.counts,
    newCurrencies,
    newCities,
    newCountries,
    pendingTotal,
  };
}

export async function moderateCatalogProposal(
  id: string,
  status: "approved" | "rejected",
): Promise<CatalogProposal | null> {
  await runMigrations();
  await ensureCatalogsHydrated();
  const db = getDb();
  const [row] = await db
    .select()
    .from(catalogProposals)
    .where(and(eq(catalogProposals.id, id), eq(catalogProposals.status, "pending")))
    .limit(1);
  if (!row) return null;

  const now = new Date().toISOString();

  if (status === "approved") {
    const code = row.code.toUpperCase();
    if (row.kind === "currency") {
      const item = row.payload as unknown as BcCurrency;
      await upsertCurrency({ ...item, code });
    } else if (row.kind === "city") {
      const item = row.payload as unknown as BcCity;
      await upsertCity({ ...item, code });
    } else if (row.kind === "country") {
      const item = row.payload as unknown as BcCountry;
      await upsertCountry({ ...item, code });
    }
  }

  const [updated] = await db
    .update(catalogProposals)
    .set({ status, moderatedAt: now })
    .where(eq(catalogProposals.id, id))
    .returning();

  return updated ? mapProposal(updated) : null;
}
