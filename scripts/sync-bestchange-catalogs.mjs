import { promises as fs } from "fs";
import path from "path";

const API_KEY = process.env.BESTCHANGE_API_KEY?.trim();
const API_BASE =
  process.env.BESTCHANGE_API_BASE?.trim() || "https://bestchange.app";

const OUT_DIR = path.join(process.cwd(), "src", "data", "bestchange");
const CACHE_DIR = path.join(process.cwd(), ".data", "bestchange");

async function fetchJson(endpoint) {
  const url = `${API_BASE}/v2/${API_KEY}/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "User-Agent": "CryptomonCatalogSync/1.0",
    },
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

async function main() {
  if (!API_KEY) {
    throw new Error("BESTCHANGE_API_KEY is missing");
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });

  console.log("Fetching BestChange catalogs…");

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

  const rawBundle = {
    fetchedAt: new Date().toISOString(),
    source: API_BASE,
    langs: langs.langs,
    groups: { ru: groupsRu.groups, en: groupsEn.groups },
    countries: { ru: countriesRu.countries, en: countriesEn.countries },
    cities: { ru: citiesRu.cities, en: citiesEn.cities },
    currencies: { ru: currenciesRu.currencies, en: currenciesEn.currencies },
    changers: { ru: changersRu.changers },
  };

  await fs.writeFile(
    path.join(CACHE_DIR, "raw-bundle.json"),
    JSON.stringify(rawBundle),
    "utf8",
  );

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

  const catalogs = {
    fetchedAt: new Date().toISOString(),
    source: API_BASE,
    langs: langs.langs,
    counts: {
      groups: groups.length,
      countries: countries.length,
      cities: cities.length,
      currencies: currencies.length,
      changers: changers.length,
    },
    groups,
    countries,
    cities,
    currencies,
    changers,
  };

  await fs.writeFile(
    path.join(OUT_DIR, "catalogs.json"),
    JSON.stringify(catalogs, null, 2),
    "utf8",
  );

  const currencyByCode = Object.fromEntries(
    currencies.map((c) => [c.code, c]),
  );
  const cityByCode = Object.fromEntries(cities.map((c) => [c.code, c]));
  const countryByCodeMap = Object.fromEntries(
    countries.map((c) => [c.code, c]),
  );

  await fs.writeFile(
    path.join(OUT_DIR, "currency-by-code.json"),
    JSON.stringify(currencyByCode),
    "utf8",
  );
  await fs.writeFile(
    path.join(OUT_DIR, "city-by-code.json"),
    JSON.stringify(cityByCode),
    "utf8",
  );
  await fs.writeFile(
    path.join(OUT_DIR, "country-by-code.json"),
    JSON.stringify(countryByCodeMap),
    "utf8",
  );
  await fs.writeFile(
    path.join(OUT_DIR, "groups.json"),
    JSON.stringify(groups, null, 2),
    "utf8",
  );

  const index = {
    fetchedAt: catalogs.fetchedAt,
    counts: catalogs.counts,
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

  await fs.writeFile(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(index),
    "utf8",
  );

  console.log("Saved catalogs:", catalogs.counts);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
