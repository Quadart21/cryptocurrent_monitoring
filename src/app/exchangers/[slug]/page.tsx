import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AchievementBadges } from "@/components/AchievementBadges";
import { ExchangerLogoMark } from "@/components/ExchangerLogoMark";
import {
  ExchangerOutboundLink,
  ExchangerPageViewBeacon,
} from "@/components/ExchangerOutboundLink";
import { ExchangerReviews } from "@/components/ExchangerReviews";
import {
  getActiveRates,
  getExchangerBySlug,
  resolveExchangerAchievements,
} from "@/lib/store";
import { formatRating, formatWorkingSince } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ex = await getExchangerBySlug(slug);
  return { title: ex ? ex.name : "Обменник" };
}

export default async function ExchangerPage({ params }: Props) {
  const { slug } = await params;
  const ex = await getExchangerBySlug(slug);
  if (!ex) notFound();

  const [livePairs, badges] = await Promise.all([
    getActiveRates().then((rates) =>
      rates.filter((o) => o.exchangerId === ex.id).length,
    ),
    resolveExchangerAchievements(ex.achievementIds),
  ]);
  const directions = Math.max(ex.pairCount, livePairs);

  return (
    <div className="space-y-6">
      <ExchangerPageViewBeacon exchangerId={ex.id} />
      <Link href="/exchangers" className="text-sm text-ink-muted hover:text-accent">
        ← Все обменники
      </Link>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <ExchangerLogoMark
              name={ex.name}
              exchangerId={ex.id}
              logo={ex.logo}
              size={64}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold text-ink">
                  {ex.name}
                </h1>
                <AchievementBadges achievements={badges} size={22} />
              </div>
              <p className="mt-2 max-w-2xl text-ink-muted">{ex.description}</p>
              <p className="mt-2 break-all text-xs text-ink-muted">
                Фид: {ex.feedUrl}
              </p>
            </div>
          </div>
          {ex.website ? (
            <ExchangerOutboundLink
              exchangerId={ex.id}
              href={ex.website}
              className="btn-primary inline-flex w-fit rounded-2xl px-4 py-2.5 text-sm font-semibold"
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

      <ExchangerReviews exchangerId={ex.id} exchangerName={ex.name} />
    </div>
  );
}
