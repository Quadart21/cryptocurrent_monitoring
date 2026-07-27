import type { Metadata } from "next";
import Link from "next/link";
import { AchievementBadges } from "@/components/AchievementBadges";
import { ExchangerLogoMark } from "@/components/ExchangerLogoMark";
import { TrackedExchangerLink } from "@/components/ads/TrackedExchangerLink";
import { pickWeightedRandom } from "@/lib/ads";
import { listAchievements, listActiveAds, listExchangers } from "@/lib/store";
import { formatRating } from "@/lib/format";

export const metadata: Metadata = { title: "Обменники" };
export const revalidate = 60;

const statusLabel: Record<string, string> = {
  active: "Онлайн",
  error: "Ошибка фида",
  pending: "На проверке",
  rejected: "Отклонён",
};

export default async function ExchangersPage() {
  const [exchangers, achievements, highlightAds] = await Promise.all([
    listExchangers({ publicOnly: true }),
    listAchievements(),
    listActiveAds({ placement: "exchangers" }),
  ]);
  const achMap = new Map(achievements.map((a) => [a.id, a]));

  // Один случайный highlight на загрузку (если несколько в слоте)
  const chosen = pickWeightedRandom(highlightAds);
  const sponsoredId = chosen?.exchangerId ?? null;
  const sponsoredAdId = chosen?.id ?? null;

  const sorted = [...exchangers].sort((a, b) => {
    const as = a.id === sponsoredId ? 1 : 0;
    const bs = b.id === sponsoredId ? 1 : 0;
    if (bs !== as) return bs - as;
    return b.rating - a.rating;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Обменники
          </h1>
          <p className="mt-2 text-ink-muted">
            Курсы читаются из XML-фидов раз в минуту.
          </p>
        </div>
        <Link
          href="/apply"
          className="btn-primary inline-flex w-fit rounded-2xl px-4 py-2.5 text-sm font-semibold"
        >
          Добавить обменник
        </Link>
      </div>

      <div className="card divide-y divide-line overflow-hidden">
        {sorted.map((ex, index) => {
          const badges = (ex.achievementIds ?? [])
            .map((id) => achMap.get(id))
            .filter((a): a is NonNullable<typeof a> => Boolean(a));
          const isAd = ex.id === sponsoredId;
          return (
            <TrackedExchangerLink
              key={ex.id}
              href={`/exchangers/${ex.slug}`}
              adId={isAd ? sponsoredAdId : null}
              className={`flex flex-col gap-3 px-5 py-4 transition hover:bg-accent-soft/40 sm:flex-row sm:items-center sm:justify-between ${
                isAd ? "bg-accent-soft/35 ring-1 ring-inset ring-accent/20" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="mt-1 w-6 tabular-nums text-sm text-ink-muted">
                  {index + 1}
                </span>
                <ExchangerLogoMark
                  name={ex.name}
                  exchangerId={ex.id}
                  logo={ex.logo}
                  size={44}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-semibold text-ink">{ex.name}</p>
                    <AchievementBadges achievements={badges} size={16} />
                    {isAd ? (
                      <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        Реклама
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-ink-muted">
                    {ex.description}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 pl-10 text-sm sm:pl-0">
                <span>★ {formatRating(ex.rating, ex.reviews)}</span>
                <span className="text-ink-muted">{ex.pairCount} пар</span>
                <span className="text-ink-muted">
                  {statusLabel[ex.status] ?? ex.status}
                </span>
              </div>
            </TrackedExchangerLink>
          );
        })}
      </div>
    </div>
  );
}
