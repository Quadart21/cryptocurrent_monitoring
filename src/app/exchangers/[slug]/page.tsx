import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AchievementBadges } from "@/components/AchievementBadges";
import { ExchangerPageAdSlot } from "@/components/ads/SiteAds";
import { ExchangerLogoMark } from "@/components/ExchangerLogoMark";
import {
  ExchangerOutboundLink,
  ExchangerPageViewBeacon,
} from "@/components/ExchangerOutboundLink";
import { ExchangerReviews } from "@/components/ExchangerReviews";
import { ComplaintForm } from "@/components/ComplaintForm";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { ShareButtons } from "@/components/seo/ShareButtons";
import { pairPath } from "@/lib/bestchange/pair-slug";
import { absoluteUrl, normalizeSiteUrl } from "@/lib/seo";
import {
  buildAggregateRatingJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo-jsonld";
import { exchangerSeoSections } from "@/lib/seo-landing-content";
import { SeoContentBlocks } from "@/components/seo/SeoContentBlocks";
import {
  getActiveRates,
  getExchangerBySlug,
  getSeoSettings,
  resolveExchangerAchievements,
} from "@/lib/store";
import { formatRating, formatWorkingSince } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ex = await getExchangerBySlug(slug, { publicOnly: true });
  if (!ex) return { title: "Обменник" };
  const seo = await getSeoSettings();
  const title = `${ex.name} — отзывы, рейтинг и курсы`;
  const description =
    ex.description?.trim() ||
    `Обменник ${ex.name}: рейтинг ${formatRating(ex.rating, ex.reviews)}, ${ex.reviews} отзывов, актуальные направления на GapSnap.`;
  const path = `/exchangers/${ex.slug}`;
  const canonical = absoluteUrl(seo.siteUrl, path) ?? path;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

export default async function ExchangerPage({ params }: Props) {
  const { slug } = await params;
  const ex = await getExchangerBySlug(slug, { publicOnly: true });
  if (!ex) notFound();

  const [liveRates, badges, seo] = await Promise.all([
    getActiveRates(),
    resolveExchangerAchievements(ex.achievementIds),
    getSeoSettings(),
  ]);
  const ownRates = liveRates.filter((o) => o.exchangerId === ex.id);
  const livePairs = ownRates.length;
  const directions = Math.max(ex.pairCount, livePairs);
  const pairLinks = [
    ...new Map(
      ownRates.map((r) => [`${r.from}:${r.to}`, [r.from, r.to] as const]),
    ).values(),
  ].slice(0, 24);

  const path = `/exchangers/${ex.slug}`;
  const shareUrl =
    absoluteUrl(seo.siteUrl, path) ??
    (normalizeSiteUrl(seo.siteUrl) ? undefined : undefined);

  return (
    <div className="space-y-6">
      <JsonLd
        data={[
          buildBreadcrumbJsonLd(seo, [
            { name: "Главная", path: "/" },
            { name: "Обменники", path: "/exchangers" },
            { name: ex.name, path },
          ]),
          buildAggregateRatingJsonLd({
            seo,
            name: ex.name,
            urlPath: path,
            description: ex.description,
            rating: ex.rating,
            reviewCount: ex.reviews,
          }),
        ].filter(Boolean) as object[]}
      />
      <ExchangerPageViewBeacon exchangerId={ex.id} />
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { href: "/exchangers", label: "Обменники" },
          { label: ex.name },
        ]}
      />

      <div className="card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <ExchangerLogoMark
              name={ex.name}
              exchangerId={ex.id}
              logo={ex.logo}
              size={56}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                  {ex.name}
                </h1>
                <AchievementBadges achievements={badges} size={22} />
                {ex.verified ? (
                  <span className="rounded-lg bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok">
                    Проверен
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-2xl text-sm text-ink-muted sm:text-base">
                {ex.description}
              </p>
              <div className="mt-3">
                <ShareButtons title={ex.name} url={shareUrl} />
              </div>
            </div>
          </div>
          {ex.website ? (
            <ExchangerOutboundLink
              exchangerId={ex.id}
              href={ex.website}
              className="btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold sm:w-fit"
            >
              Перейти на сайт
            </ExchangerOutboundLink>
          ) : null}
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Рейтинг",
              value: `★ ${formatRating(ex.rating, ex.reviews)}`,
              hint: ex.reviews
                ? `${ex.reviewsPositive} пол. / ${ex.reviewsNegative} отр.`
                : "нет одобренных отзывов",
            },
            {
              label: "Направлений",
              value: String(directions),
              hint: "активных пар в XML-фиде",
            },
            {
              label: "В работе",
              value: `Работает ${formatWorkingSince(ex.approvedAt)}`,
              hint: "с момента одобрения на мониторинге",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-line bg-bg-soft/60 p-3"
            >
              <dt className="text-xs uppercase tracking-[0.14em] text-ink-muted">
                {item.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {item.value}
              </dd>
              {"hint" in item && item.hint ? (
                <p className="mt-1 text-xs text-ink-muted">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </dl>
      </div>

      {pairLinks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            Валютные пары обменника
          </h2>
          <div className="flex flex-wrap gap-2">
            {pairLinks.map(([from, to]) => (
              <Link
                key={`${from}-${to}`}
                href={pairPath(from, to)}
                className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:border-accent/40 hover:text-ink"
              >
                {from} → {to}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <SeoContentBlocks
        className="border-t border-line/70 pt-8"
        sections={exchangerSeoSections({
          name: ex.name,
          slug: ex.slug,
          description: ex.description,
          rating: ex.rating,
          reviews: ex.reviews,
          reviewsPositive: ex.reviewsPositive,
          reviewsNegative: ex.reviewsNegative,
          pairCount: directions,
          verified: ex.verified,
          approvedAt: ex.approvedAt,
          workingSinceLabel: formatWorkingSince(ex.approvedAt),
          siteName: seo.siteName || "GapSnap",
        })}
      />

      <ExchangerPageAdSlot />

      <ExchangerReviews
        exchangerId={ex.id}
        exchangerName={ex.name}
        logo={ex.logo}
      />

      <ComplaintForm exchangerId={ex.id} exchangerName={ex.name} />
    </div>
  );
}
