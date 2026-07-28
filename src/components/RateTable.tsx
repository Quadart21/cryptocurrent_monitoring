import Link from "next/link";
import { AchievementBadges } from "@/components/AchievementBadges";
import {
  formatCurrencyAmount,
  formatRate,
  formatRating,
  formatReserve,
} from "@/lib/format";

export type LiveOffer = {
  id: string;
  from: string;
  to: string;
  rate: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  receive: number;
  rank: number;
  city?: string | null;
  exchanger: {
    id: string;
    slug: string;
    name: string;
    website: string;
    rating: number;
    reviews: number;
    verified: boolean;
    status: "online" | "offline" | "busy";
    logoUrl?: string | null;
    achievements?: Array<{
      id: string;
      name: string;
      description: string;
      svg: string;
    }>;
  };
};

const statusLabel = {
  online: "Онлайн",
  busy: "Занят",
  offline: "Офлайн",
} as const;

const statusClass = {
  online: "text-[var(--ok)]",
  busy: "text-[var(--busy)]",
  offline: "text-[var(--offline)]",
} as const;

export function RateTable({
  offers,
  amount,
  from,
  to,
}: {
  offers: LiveOffer[];
  amount: number;
  from: string;
  to: string;
}) {
  if (!offers.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-bg-elevated/70 px-6 py-14 text-center">
        <p className="font-display text-lg text-ink">Пусто по этой паре</p>
        <p className="mt-2 text-sm text-ink-muted">
          Выберите другое направление или дождитесь синхронизации XML-фидов.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line/80 bg-bg-elevated/90">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line/80 bg-white/50 text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium sm:px-5">#</th>
              <th className="px-4 py-3 font-medium sm:px-5">Обменник</th>
              <th className="px-4 py-3 font-medium sm:px-5">Отдаёте</th>
              <th className="px-4 py-3 font-medium sm:px-5">Получаете</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell sm:px-5">
                Резерв
              </th>
              <th className="px-4 py-3 font-medium sm:px-5" />
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => {
              const outOfRange =
                amount > 0 &&
                (amount < offer.minAmount ||
                  (Number.isFinite(offer.maxAmount) &&
                    amount > offer.maxAmount));

              return (
                <tr
                  key={offer.id}
                  className="border-b border-line/50 transition-colors last:border-0 hover:bg-accent-soft/40"
                >
                  <td className="px-4 py-4 tabular-nums text-ink-muted sm:px-5">
                    {offer.rank}
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/exchangers/${offer.exchanger.slug}`}
                          className="font-semibold text-ink hover:text-accent-deep"
                        >
                          {offer.exchanger.name}
                        </Link>
                        <AchievementBadges
                          achievements={offer.exchanger.achievements ?? []}
                          size={16}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <span>★ {formatRating(offer.exchanger.rating, offer.exchanger.reviews)}</span>
                        <span>·</span>
                        <span>{offer.exchanger.reviews} отзывов</span>
                        {offer.exchanger.verified && (
                          <>
                            <span>·</span>
                            <span className="text-accent-deep">проверен</span>
                          </>
                        )}
                        <span>·</span>
                        <span className={statusClass[offer.exchanger.status]}>
                          {statusLabel[offer.exchanger.status]}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 tabular-nums sm:px-5">
                    {formatCurrencyAmount(amount || 0, from)}{" "}
                    <span className="text-ink-muted">{from}</span>
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <div className="font-semibold tabular-nums text-accent-deep">
                      {amount > 0
                        ? formatCurrencyAmount(offer.receive, to)
                        : formatRate(offer.rate)}{" "}
                      <span className="font-medium text-ink-muted">{to}</span>
                    </div>
                    {outOfRange && (
                      <p className="mt-1 text-xs text-[var(--warn)]">
                        Вне лимита {formatCurrencyAmount(offer.minAmount, from)}–
                        {Number.isFinite(offer.maxAmount)
                          ? formatCurrencyAmount(offer.maxAmount, from)
                          : "∞"}{" "}
                        {from}
                      </p>
                    )}
                  </td>
                  <td className="hidden px-4 py-4 tabular-nums text-ink-muted md:table-cell sm:px-5">
                    {formatReserve(offer.reserve, to)}
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <a
                      href={offer.exchanger.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-deep"
                    >
                      Обменять
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
