import "server-only";

import { count, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import {
  bcCatalogMeta,
  bcCities,
  bcCountries,
  bcCurrencies,
  bcGroups,
} from "@/db/schema";
import type {
  BcCity,
  BcCountry,
  BcCurrency,
  BcGroup,
} from "@/lib/bestchange/catalog-types";
import bundledCurrencyByCode from "@/data/bestchange/currency-by-code.json";
import bundledCityByCode from "@/data/bestchange/city-by-code.json";
import bundledCountryByCode from "@/data/bestchange/country-by-code.json";
import bundledGroups from "@/data/bestchange/groups.json";
import bundledIndex from "@/data/bestchange/index.json";

export type CatalogSnapshot = {
  currencies: Record<string, BcCurrency>;
  cities: Record<string, BcCity>;
  countries: Record<string, BcCountry>;
  groups: BcGroup[];
  fetchedAt: string;
  counts: {
    groups: number;
    countries: number;
    cities: number;
    currencies: number;
    changers: number;
  };
  source: "bundled" | "db";
};

let snapshot: CatalogSnapshot | null = null;
let hydratePromise: Promise<void> | null = null;

function emptySnapshot(): CatalogSnapshot {
  return {
    currencies: {},
    cities: {},
    countries: {},
    groups: [],
    fetchedAt: "",
    counts: {
      groups: 0,
      countries: 0,
      cities: 0,
      currencies: 0,
      changers: 0,
    },
    source: "db",
  };
}

function mapCurrency(row: typeof bcCurrencies.$inferSelect): BcCurrency {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameEn: row.nameEn,
    viewname: row.viewname,
    urlname: row.urlname || undefined,
    crypto: row.crypto,
    cash: row.cash,
    groupId: row.groupId,
    ps: row.ps,
    defamt: row.defamt,
    bigamt: row.bigamt,
    rank: row.rank,
  };
}

function mapCity(row: typeof bcCities.$inferSelect): BcCity {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameEn: row.nameEn,
    countryId: row.countryId ?? undefined,
    countryCode: row.countryCode,
    countryName: row.countryName,
    rank: row.rank,
  };
}

function mapCountry(row: typeof bcCountries.$inferSelect): BcCountry {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameEn: row.nameEn,
    rank: row.rank,
  };
}

function mapGroup(row: typeof bcGroups.$inferSelect): BcGroup {
  return { id: row.id, name: row.name, nameEn: row.nameEn };
}

function buildSnapshotFromRows(
  groups: typeof bcGroups.$inferSelect[],
  countries: typeof bcCountries.$inferSelect[],
  cities: typeof bcCities.$inferSelect[],
  currencies: typeof bcCurrencies.$inferSelect[],
  fetchedAt: string,
): CatalogSnapshot {
  return {
    groups: groups.map(mapGroup),
    countries: Object.fromEntries(countries.map((c) => [c.code, mapCountry(c)])),
    cities: Object.fromEntries(cities.map((c) => [c.code, mapCity(c)])),
    currencies: Object.fromEntries(
      currencies.map((c) => [c.code, mapCurrency(c)]),
    ),
    fetchedAt,
    counts: {
      groups: groups.length,
      countries: countries.length,
      cities: cities.length,
      currencies: currencies.length,
      changers: 0,
    },
    source: "db",
  };
}

/** Seed DB tables from bundled JSON if empty (one-time / first boot). */
export async function seedCatalogsFromBundledIfEmpty(): Promise<boolean> {
  await runMigrations();
  const db = getDb();
  const [curCount] = await db.select({ n: count() }).from(bcCurrencies);
  if ((curCount?.n ?? 0) > 0) return false;

  const currencies = Object.values(
    bundledCurrencyByCode as Record<string, BcCurrency>,
  );
  const cities = Object.values(bundledCityByCode as Record<string, BcCity>);
  const countries = Object.values(
    bundledCountryByCode as Record<string, BcCountry>,
  );
  const groups = bundledGroups as BcGroup[];
  const index = bundledIndex as { fetchedAt?: string };
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    if (groups.length) {
      await tx.insert(bcGroups).values(
        groups.map((g) => ({
          id: g.id,
          name: g.name,
          nameEn: g.nameEn ?? "",
        })),
      );
    }
    if (countries.length) {
      await tx.insert(bcCountries).values(
        countries.map((c) => ({
          code: c.code,
          id: c.id,
          name: c.name,
          nameEn: c.nameEn ?? "",
          rank: c.rank ?? 9999,
        })),
      );
    }
    // chunk inserts for large tables
    const chunk = 200;
    for (let i = 0; i < cities.length; i += chunk) {
      const slice = cities.slice(i, i + chunk);
      await tx.insert(bcCities).values(
        slice.map((c) => ({
          code: c.code,
          id: c.id,
          name: c.name,
          nameEn: c.nameEn ?? "",
          countryId: c.countryId ?? null,
          countryCode: c.countryCode ?? "",
          countryName: c.countryName ?? "",
          rank: c.rank ?? 9999,
        })),
      );
    }
    for (let i = 0; i < currencies.length; i += chunk) {
      const slice = currencies.slice(i, i + chunk);
      await tx.insert(bcCurrencies).values(
        slice.map((c) => ({
          code: c.code,
          id: c.id,
          name: c.name,
          nameEn: c.nameEn ?? "",
          viewname: c.viewname ?? c.code,
          urlname: c.urlname ?? "",
          crypto: Boolean(c.crypto),
          cash: Boolean(c.cash),
          groupId: c.groupId ?? 0,
          ps: c.ps ?? 0,
          defamt: c.defamt ?? 0,
          bigamt: c.bigamt ?? 0,
          rank: c.rank ?? 9999,
        })),
      );
    }
    await tx
      .insert(bcCatalogMeta)
      .values({
        id: 1,
        fetchedAt: index.fetchedAt ?? now,
        updatedAt: now,
        source: "bundled-seed",
      })
      .onConflictDoUpdate({
        target: bcCatalogMeta.id,
        set: {
          fetchedAt: index.fetchedAt ?? now,
          updatedAt: now,
          source: "bundled-seed",
        },
      });
  });

  console.info(
    `[gapsnap] catalog seeded into DB: ${currencies.length} currencies, ${cities.length} cities`,
  );
  return true;
}

export async function loadCatalogSnapshotFromDb(): Promise<CatalogSnapshot> {
  await runMigrations();
  await seedCatalogsFromBundledIfEmpty();
  await seedGroupsFromBundledIfEmpty();
  const db = getDb();
  const [groups, countries, cities, currencies, meta] = await Promise.all([
    db.select().from(bcGroups),
    db.select().from(bcCountries),
    db.select().from(bcCities),
    db.select().from(bcCurrencies),
    db.select().from(bcCatalogMeta).where(eq(bcCatalogMeta.id, 1)).limit(1),
  ]);

  if (!currencies.length) {
    return emptySnapshot();
  }

  return buildSnapshotFromRows(
    groups,
    countries,
    cities,
    currencies,
    meta[0]?.fetchedAt ?? meta[0]?.updatedAt ?? "",
  );
}

/** If currencies exist but groups table is empty, seed group labels. */
async function seedGroupsFromBundledIfEmpty(): Promise<void> {
  const db = getDb();
  const [groupCount] = await db.select({ n: count() }).from(bcGroups);
  if ((groupCount?.n ?? 0) > 0) return;
  const groups = bundledGroups as BcGroup[];
  if (!groups.length) return;
  await db
    .insert(bcGroups)
    .values(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        nameEn: g.nameEn ?? "",
      })),
    )
    .onConflictDoNothing();
  console.info(`[gapsnap] catalog groups backfilled: ${groups.length}`);
}

export function getCatalogSnapshot(): CatalogSnapshot {
  return snapshot ?? emptySnapshot();
}

export function replaceCatalogSnapshot(next: CatalogSnapshot): void {
  snapshot = next;
}

export async function invalidateCatalogCache(): Promise<CatalogSnapshot> {
  hydratePromise = null;
  const next = await loadCatalogSnapshotFromDb();
  snapshot = next;
  return next;
}

export async function ensureCatalogsHydrated(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      snapshot = await loadCatalogSnapshotFromDb();
    })().catch((error) => {
      console.error("[gapsnap] catalog hydrate from DB failed", error);
      if (!snapshot) snapshot = emptySnapshot();
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

export async function touchCatalogMeta(source = "admin"): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .insert(bcCatalogMeta)
    .values({ id: 1, fetchedAt: now, updatedAt: now, source })
    .onConflictDoUpdate({
      target: bcCatalogMeta.id,
      set: { updatedAt: now, source },
    });
}

export async function upsertCurrency(item: BcCurrency): Promise<BcCurrency> {
  await runMigrations();
  const db = getDb();
  const code = item.code.toUpperCase();
  await db
    .insert(bcCurrencies)
    .values({
      code,
      id: item.id,
      name: item.name,
      nameEn: item.nameEn ?? "",
      viewname: item.viewname || code,
      urlname: item.urlname ?? "",
      crypto: Boolean(item.crypto),
      cash: Boolean(item.cash),
      groupId: item.groupId ?? 0,
      ps: item.ps ?? 0,
      defamt: item.defamt ?? 0,
      bigamt: item.bigamt ?? 0,
      rank: item.rank ?? 9999,
    })
    .onConflictDoUpdate({
      target: bcCurrencies.code,
      set: {
        id: item.id,
        name: item.name,
        nameEn: item.nameEn ?? "",
        viewname: item.viewname || code,
        urlname: item.urlname ?? "",
        crypto: Boolean(item.crypto),
        cash: Boolean(item.cash),
        groupId: item.groupId ?? 0,
        ps: item.ps ?? 0,
        defamt: item.defamt ?? 0,
        bigamt: item.bigamt ?? 0,
        rank: item.rank ?? 9999,
      },
    });
  await touchCatalogMeta("admin");
  await invalidateCatalogCache();
  return getCatalogSnapshot().currencies[code]!;
}

export async function upsertCity(item: BcCity): Promise<BcCity> {
  await runMigrations();
  const db = getDb();
  const code = item.code.toUpperCase();
  await db
    .insert(bcCities)
    .values({
      code,
      id: item.id,
      name: item.name,
      nameEn: item.nameEn ?? "",
      countryId: item.countryId ?? null,
      countryCode: item.countryCode ?? "",
      countryName: item.countryName ?? "",
      rank: item.rank ?? 9999,
    })
    .onConflictDoUpdate({
      target: bcCities.code,
      set: {
        id: item.id,
        name: item.name,
        nameEn: item.nameEn ?? "",
        countryId: item.countryId ?? null,
        countryCode: item.countryCode ?? "",
        countryName: item.countryName ?? "",
        rank: item.rank ?? 9999,
      },
    });
  await touchCatalogMeta("admin");
  await invalidateCatalogCache();
  return getCatalogSnapshot().cities[code]!;
}

export async function upsertCountry(item: BcCountry): Promise<BcCountry> {
  await runMigrations();
  const db = getDb();
  const code = item.code.toUpperCase();
  await db
    .insert(bcCountries)
    .values({
      code,
      id: item.id,
      name: item.name,
      nameEn: item.nameEn ?? "",
      rank: item.rank ?? 9999,
    })
    .onConflictDoUpdate({
      target: bcCountries.code,
      set: {
        id: item.id,
        name: item.name,
        nameEn: item.nameEn ?? "",
        rank: item.rank ?? 9999,
      },
    });
  await touchCatalogMeta("admin");
  await invalidateCatalogCache();
  return getCatalogSnapshot().countries[code]!;
}

export async function upsertGroup(item: BcGroup): Promise<BcGroup> {
  await runMigrations();
  const db = getDb();
  await db
    .insert(bcGroups)
    .values({
      id: item.id,
      name: item.name,
      nameEn: item.nameEn ?? "",
    })
    .onConflictDoUpdate({
      target: bcGroups.id,
      set: { name: item.name, nameEn: item.nameEn ?? "" },
    });
  await touchCatalogMeta("admin");
  await invalidateCatalogCache();
  return getCatalogSnapshot().groups.find((g) => g.id === item.id)!;
}

export async function deleteCurrency(code: string): Promise<boolean> {
  await runMigrations();
  const db = getDb();
  const result = await db
    .delete(bcCurrencies)
    .where(eq(bcCurrencies.code, code.toUpperCase()))
    .returning({ code: bcCurrencies.code });
  if (result.length) {
    await touchCatalogMeta("admin");
    await invalidateCatalogCache();
  }
  return result.length > 0;
}

export async function deleteCity(code: string): Promise<boolean> {
  await runMigrations();
  const db = getDb();
  const result = await db
    .delete(bcCities)
    .where(eq(bcCities.code, code.toUpperCase()))
    .returning({ code: bcCities.code });
  if (result.length) {
    await touchCatalogMeta("admin");
    await invalidateCatalogCache();
  }
  return result.length > 0;
}

export async function deleteCountry(code: string): Promise<boolean> {
  await runMigrations();
  const db = getDb();
  const result = await db
    .delete(bcCountries)
    .where(eq(bcCountries.code, code.toUpperCase()))
    .returning({ code: bcCountries.code });
  if (result.length) {
    await touchCatalogMeta("admin");
    await invalidateCatalogCache();
  }
  return result.length > 0;
}

export async function deleteGroup(id: number): Promise<boolean> {
  await runMigrations();
  const db = getDb();
  const result = await db
    .delete(bcGroups)
    .where(eq(bcGroups.id, id))
    .returning({ id: bcGroups.id });
  if (result.length) {
    await touchCatalogMeta("admin");
    await invalidateCatalogCache();
  }
  return result.length > 0;
}
