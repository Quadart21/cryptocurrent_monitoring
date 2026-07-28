/**
 * Shared BestChange catalog builder.
 * Used by CLI (`npm run sync:catalogs`) and discovery poller.
 */
import { promises as fs } from "fs";
import path from "path";

function apiKey() {
  return process.env.BESTCHANGE_API_KEY?.trim() || "";
}

function apiBase() {
  return process.env.BESTCHANGE_API_BASE?.trim() || "https://bestchange.app";
}

async function fetchJson(endpoint) {
  const key = apiKey();
  if (!key) throw new Error("BESTCHANGE_API_KEY is missing");
  const url = `${apiBase()}/v2/${key}/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "User-Agent": "GapSnapCatalogSync/1.0",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${endpoint}: HTTP ${res.status}`);
  }
  return res.json();
}

function sortByRankName(items) {
  return [...items].sort((a, b) => {
    const ra = a.rank ?? 9999;
    const rb = b.rank ?? 9999;
    if (ra !== rb) return ra - rb;
    return String(a.name ?? a.code ?? "").localeCompare(
      String(b.name ?? b.code ?? ""),
      "ru",
    );
  });
}

async function writeOutputs(outDir, payload) {
  await fs.mkdir(outDir, { recursive: true });
  const {
    catalogs,
    currencyByCode,
    cityByCode,
    countryByCode,
    groups,
    index,
    rawBundle,
  } = payload;

  await Promise.all([
    fs.writeFile(
      path.join(outDir, "catalogs.json"),
      JSON.stringify(catalogs, null, 2),
      "utf8",
    ),
    fs.writeFile(
      path.join(outDir, "currency-by-code.json"),
      JSON.stringify(currencyByCode),
      "utf8",
    ),
    fs.writeFile(
      path.join(outDir, "city-by-code.json"),
      JSON.stringify(cityByCode),
      "utf8",
    ),
    fs.writeFile(
      path.join(outDir, "country-by-code.json"),
      JSON.stringify(countryByCode),
      "utf8",
    ),
    fs.writeFile(
      path.join(outDir, "groups.json"),
      JSON.stringify(groups, null, 2),
      "utf8",
    ),
    fs.writeFile(
      path.join(outDir, "index.json"),
      JSON.stringify(index),
      "utf8",
    ),
    fs.writeFile(
      path.join(outDir, "raw-bundle.json"),
      JSON.stringify(rawBundle),
      "utf8",
    ),
  ]);
}

/** Fetch + normalize catalogs from BestChange API (no disk writes). */
export async function buildCatalogPayloadFromApi() {
  const [
    langs,
    groupsRu,
    groupsEn,
    countriesRu,
    citiesRu,
    currenciesRu,
    changersRu,
  ] = await Promise.all([
    fetchJson("langs"),
    fetchJson("groups/ru"),
    fetchJson("groups/en"),
    fetchJson("countries/ru"),
    fetchJson("cities/ru"),
    fetchJson("currencies/ru"),
    fetchJson("changers/ru"),
  ]);

  const [countriesEn, citiesEn, currenciesEn] = await Promise.all([
    fetchJson("countries/en"),
    fetchJson("cities/en"),
    fetchJson("currencies/en"),
  ]);

  const fetchedAt = new Date().toISOString();
  const rawBundle = {
    fetchedAt,
    source: apiBase(),
    langs: langs.langs,
    groups: { ru: groupsRu.groups, en: groupsEn.groups },
    countries: { ru: countriesRu.countries, en: countriesEn.countries },
    cities: { ru: citiesRu.cities, en: citiesEn.cities },
    currencies: { ru: currenciesRu.currencies, en: currenciesEn.currencies },
    changers: { ru: changersRu.changers },
  };

  const groups = sortByRankName(
    (groupsRu.groups ?? []).map((g) => ({
      id: Number(g.id),
      name: String(g.name ?? ""),
      nameEn: String(
        groupsEn.groups?.find((x) => Number(x.id) === Number(g.id))?.name ?? "",
      ),
    })),
  );

  const countries = sortByRankName(
    (countriesRu.countries ?? []).map((c) => {
      const en = countriesEn.countries?.find(
        (x) => Number(x.id) === Number(c.id),
      );
      return {
        id: Number(c.id),
        code: String(c.code ?? "").toUpperCase(),
        name: String(c.name ?? ""),
        nameEn: String(en?.name ?? ""),
        rank: Number(c.rank ?? 999),
      };
    }),
  );

  const countryById = new Map(countries.map((c) => [c.id, c]));

  const cities = sortByRankName(
    (citiesRu.cities ?? []).map((c) => {
      const en = citiesEn.cities?.find((x) => Number(x.id) === Number(c.id));
      const countryId = Number(c.country ?? 0);
      const country = countryById.get(countryId);
      return {
        id: Number(c.id),
        code: String(c.code ?? "").toUpperCase(),
        name: String(c.name ?? ""),
        nameEn: String(en?.name ?? ""),
        countryId,
        countryCode: country?.code ?? "",
        countryName: country?.name ?? "",
        rank: Number(c.rank ?? 9999),
      };
    }),
  );

  const currencies = sortByRankName(
    (currenciesRu.currencies ?? []).map((c) => {
      const en = currenciesEn.currencies?.find(
        (x) => Number(x.id) === Number(c.id),
      );
      return {
        id: Number(c.id),
        code: String(c.code ?? "").toUpperCase(),
        name: String(c.name ?? ""),
        nameEn: String(en?.name ?? ""),
        viewname: String(c.viewname ?? c.code ?? ""),
        urlname: String(c.urlname ?? ""),
        crypto: Boolean(c.crypto),
        cash: Boolean(c.cash),
        groupId: Number(c.group ?? 0),
        ps: Number(c.ps ?? 0),
        defamt: Number(c.defamt ?? 0),
        bigamt: Number(c.bigamt ?? 0),
        rank: Number(c.pos ?? c.rank ?? 9999),
      };
    }),
  );

  const changers = (changersRu.changers ?? []).map((c) => ({
    id: Number(c.id),
    name: String(c.name ?? ""),
    langs: Array.isArray(c.langs) ? c.langs : [],
    urls: c.urls ?? {},
    pages: c.pages ?? {},
  }));

  const counts = {
    groups: groups.length,
    countries: countries.length,
    cities: cities.length,
    currencies: currencies.length,
    changers: changers.length,
  };

  const catalogs = {
    fetchedAt,
    source: apiBase(),
    langs: langs.langs,
    counts,
    groups,
    countries,
    cities,
    currencies,
    changers,
  };

  const currencyByCode = Object.fromEntries(currencies.map((c) => [c.code, c]));
  const cityByCode = Object.fromEntries(cities.map((c) => [c.code, c]));
  const countryByCode = Object.fromEntries(countries.map((c) => [c.code, c]));

  const index = {
    fetchedAt,
    counts,
    groups,
    countries,
    cities: cities.map(
      ({ id, code, name, nameEn, countryCode, countryName, rank }) => ({
        id,
        code,
        name,
        nameEn,
        countryCode,
        countryName,
        rank,
      }),
    ),
    currencies: currencies.map(
      ({
        id,
        code,
        name,
        nameEn,
        viewname,
        crypto,
        cash,
        groupId,
        rank,
      }) => ({
        id,
        code,
        name,
        nameEn,
        viewname,
        crypto,
        cash,
        groupId,
        rank,
      }),
    ),
  };

  return {
    catalogs,
    currencyByCode,
    cityByCode,
    countryByCode,
    groups,
    index,
    rawBundle,
  };
}

/**
 * @param {{ outDirs?: string[], writeSrc?: boolean }} [options]
 */
export async function syncCatalogs(options = {}) {
  const cwd = process.cwd();
  const runtimeDir = path.join(cwd, ".data", "bestchange");
  const srcDir = path.join(cwd, "src", "data", "bestchange");
  const outDirs = options.outDirs?.length
    ? options.outDirs
    : [runtimeDir, ...(options.writeSrc === false ? [] : [srcDir])];

  const payload = await buildCatalogPayloadFromApi();

  for (const dir of outDirs) {
    await writeOutputs(dir, payload);
  }

  return {
    fetchedAt: payload.catalogs.fetchedAt,
    counts: payload.catalogs.counts,
    outDirs,
  };
}
