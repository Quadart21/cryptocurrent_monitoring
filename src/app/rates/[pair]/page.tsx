import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { ShareButtons } from "@/components/seo/ShareButtons";
import { PairRatesClient } from "@/components/rates/PairRatesClient";
import {
  currencyLabel,
  getCurrency,
} from "@/lib/bestchange/catalog";
import { ensureCatalogsHydrated } from "@/lib/bestchange/catalog-store";
import { parsePairSlug, pairPath, pairSlug } from "@/lib/bestchange/pair-slug";
import { buildPairDescription, buildPairFaqs } from "@/lib/pair-content";
import { formatRate } from "@/lib/format";
import { queryRates } from "@/lib/rates-query";
import { absoluteUrl, normalizeSiteUrl } from "@/lib/seo";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildPairProductJsonLd,
} from "@/lib/seo-jsonld";
import { getSeoSettings, listReviews } from "@/lib/store";

type Props = { params: Promise<{ pair: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const parsed = parsePairSlug(pair);
  if (!parsed) return { title: "Курс" };
  await ensureCatalogsHydrated();
  const rates = await queryRates({ from: parsed.from, to: parsed.to });
  const best = rates.offers[0]?.rate ?? null;
  const worst =
    rates.offers.length > 0
      ? rates.offers[rates.offers.length - 1]?.rate ?? null
      : null;
  const seo = await getSeoSettings();
  const title = `Курс ${parsed.from} к ${parsed.to} — лучшие предложения`;
  const description = buildPairDescription({
    from: parsed.from,
    to: parsed.to,
    offerCount: rates.offers.length,
    bestRate: best,
    worstRate: worst,
    siteName: seo.siteName,
  });
  const path = pairPath(parsed.from, parsed.to);
  const canonical = absoluteUrl(seo.siteUrl, path) ?? path;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function RatePairPage({ params }: Props) {
  const { pair } = await params;
  const parsed = parsePairSlug(pair);
  if (!parsed) notFound();

  await ensureCatalogsHydrated();
  if (!getCurrency(parsed.from) && !getCurrency(parsed.to)) {
    // allow unknown codes if live rates exist
  }

  const [rates, seo, reviews] = await Promise.all([
    queryRates({ from: parsed.from, to: parsed.to }),
    getSeoSettings(),
    listReviews({ status: "approved" }),
  ]);

  if (!getCurrency(parsed.from) && !getCurrency(parsed.to) && !rates.offers.length) {
    notFound();
  }

  // Canonicalize slug casing
  const canonicalSlug = pairSlug(parsed.from, parsed.to);
  if (pair !== canonicalSlug) {
    // soft: still render; sitemap uses canonical
  }

  const best = rates.offers[0]?.rate ?? null;
  const worst =
    rates.offers.length > 0
      ? Math.min(...rates.offers.map((o) => o.rate))
      : null;
  const fromL = currencyLabel(parsed.from);
  const toL = currencyLabel(parsed.to);
  const h1 = `${fromL} → ${toL}`;
  const description = buildPairDescription({
    from: parsed.from,
    to: parsed.to,
    offerCount: rates.offers.length,
    bestRate: best,
    worstRate: worst,
    siteName: seo.siteName,
  });
  const faqs = buildPairFaqs({
    from: parsed.from,
    to: parsed.to,
    offerCount: rates.offers.length,
    bestRate: best,
  });
  const path = pairPath(parsed.from, parsed.to);
  const siteUrl = normalizeSiteUrl(seo.siteUrl);
  const shareUrl = absoluteUrl(seo.siteUrl, path) ?? path;

  const crumbs = [
    { name: "Главная", path: "/" },
    { name: "Курсы", path: "/rates" },
    { name: `${fromL} → ${toL}`, path },
  ];

  const exchangerIds = new Set(rates.offers.map((o) => o.exchanger.id));
  const recentReviews = reviews
    .filter((r) => exchangerIds.has(r.exchangerId))
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      exchangerName: r.exchangerName,
      exchangerSlug: r.exchangerSlug,
      sentiment: r.sentiment,
      text: r.text,
      createdAt: r.createdAt,
    }));

  const related = rates.offers.slice(0, 8);

  return (
    <div className="space-y-6">
      <JsonLd
        data={[
          buildBreadcrumbJsonLd(seo, crumbs),
          buildFaqJsonLd(seo, faqs),
          buildPairProductJsonLd({
            seo,
            name: `Обмен ${fromL} на ${toL}`,
            description,
            urlPath: path,
            bestRate: best,
            currency: parsed.to,
            offerCount: rates.offers.length,
          }),
        ].filter(Boolean) as object[]}
      />

      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { href: "/rates", label: "Курсы" },
          { label: `${fromL} → ${toL}` },
        ]}
      />

      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {h1}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted sm:text-base">
          {description}
        </p>
        <ShareButtons
          title={`Курс ${fromL} к ${toL}`}
          url={siteUrl ? shareUrl : undefined}
          text={description}
        />
      </header>

      <PairRatesClient
        from={parsed.from}
        to={parsed.to}
        currencies={rates.currencies}
        initialOffers={rates.offers}
        initialLastSyncAt={rates.lastGlobalSyncAt}
        recentReviews={recentReviews}
      />

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold text-ink">FAQ</h2>
        <div className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-sm font-semibold text-ink">{f.q}</h3>
              <p className="mt-1 text-sm text-ink-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {related.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            Обменники по этому направлению
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/exchangers/${o.exchanger.slug}`}
                  className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm hover:border-accent/40"
                >
                  <span className="font-semibold text-ink">
                    {o.exchanger.name}
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {formatRate(o.rate)} {parsed.to}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-ink-muted">
        Смотрите также{" "}
        <Link href="/" className="text-accent hover:underline">
          живой мониторинг на главной
        </Link>{" "}
        и{" "}
        <Link href="/exchangers" className="text-accent hover:underline">
          каталог обменников
        </Link>
        .
      </p>
    </div>
  );
}
