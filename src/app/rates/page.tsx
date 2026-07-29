import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { currencyLabel } from "@/lib/bestchange/catalog";
import { ensureCatalogsHydrated } from "@/lib/bestchange/catalog-store";
import { pairPath } from "@/lib/bestchange/pair-slug";
import {
  POPULAR_FEED_PAIRS,
  mergePopularPairs,
} from "@/lib/bestchange/popular-pairs";
import { getTopDemandPairs, listActiveRatePairs } from "@/lib/store";

export const metadata: Metadata = {
  title: "Курсы валют и направления обмена",
  description:
    "Популярные и активные направления обмена: курсы, число обменников, сравнение предложений.",
};
export const dynamic = "force-dynamic";

export default async function RatesHubPage() {
  await ensureCatalogsHydrated();
  const [live, all] = await Promise.all([
    getTopDemandPairs({ mode: "online", limit: 24 }),
    listActiveRatePairs(120),
  ]);
  const popular = mergePopularPairs(live, POPULAR_FEED_PAIRS, 12);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Главная" }, { label: "Курсы" }]}
      />
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Курсы и направления
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted sm:text-base">
          Выберите валютную пару — откроется страница с таблицей обменников,
          калькулятором и FAQ.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Популярные</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map(([from, to]) => (
            <Link
              key={`${from}-${to}`}
              href={pairPath(from, to)}
              className="flex min-h-12 flex-col justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold hover:border-accent/40"
            >
              {currencyLabel(from)} → {currencyLabel(to)}
              <span className="mt-1 block text-xs font-normal text-ink-muted">
                {from} → {to}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          Активные пары ({all.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {all.map(([from, to]) => (
            <Link
              key={`all-${from}-${to}`}
              href={pairPath(from, to)}
              className="flex min-h-11 items-center rounded-xl border border-line/70 px-3 py-2.5 text-xs font-medium text-ink-muted hover:border-accent/40 hover:text-ink"
            >
              {from} → {to}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
