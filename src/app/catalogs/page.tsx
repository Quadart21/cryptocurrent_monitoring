import type { Metadata } from "next";
import {
  catalogMeta,
  listCities,
  listCountries,
  listCurrencies,
  listGroups,
} from "@/lib/bestchange/catalog";

export const metadata: Metadata = { title: "Справочники BestChange" };

export default function CatalogsPage() {
  const meta = catalogMeta();
  const groups = listGroups();
  const currencies = listCurrencies();
  const cities = listCities();
  const countries = listCountries();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Справочники BestChange
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          XML-коды валют, города и страны. Обновлено:{" "}
          {new Date(meta.fetchedAt).toLocaleString("ru-RU")}. Валют:{" "}
          {meta.counts.currencies}, городов: {meta.counts.cities}, стран:{" "}
          {meta.counts.countries}.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="font-display text-xl font-semibold">Группы</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="rounded-2xl border border-line bg-bg-soft/70 px-3 py-2 text-sm"
            >
              <span className="font-medium">{g.name}</span>
              <span className="ml-2 text-ink-muted">{g.nameEn}</span>
            </li>
          ))}
        </ul>
      </section>

      <CatalogTable
        title={`Валюты / XML-коды (${currencies.length})`}
        headers={["XML", "Название", "ID", "Тип"]}
        rows={currencies.map((c) => [
          c.code,
          c.name,
          String(c.id),
          c.cash ? "cash" : c.crypto ? "crypto" : "fiat/ps",
        ])}
      />

      <CatalogTable
        title={`Города (${cities.length})`}
        headers={["Код", "Город", "Страна"]}
        rows={cities.map((c) => [
          c.code,
          c.name,
          `${c.countryName} (${c.countryCode})`,
        ])}
      />

      <CatalogTable
        title={`Страны (${countries.length})`}
        headers={["ISO", "Название", "EN"]}
        rows={countries.map((c) => [c.code, c.name, c.nameEn])}
      />
    </div>
  );
}

function CatalogTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-bg-elevated text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("|")} className="border-t border-line/60">
                {row.map((cell, i) => (
                  <td
                    key={`${row[0]}-${i}`}
                    className={`px-4 py-2 ${i === 0 ? "font-mono text-xs font-semibold" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
