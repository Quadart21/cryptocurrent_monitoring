"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { AchievementBadges } from "@/components/AchievementBadges";
import { useAds } from "@/components/ads/useAds";
import { trackAdClick, trackAdImpression } from "@/components/ads/track";
import type { LiveOffer } from "@/components/RateTable";
import { pickWeightedRandom } from "@/lib/ads";
import { cityLabel, currencyDecimals } from "@/lib/bestchange/catalog";
import { formatAmount, formatRating, formatReserve } from "@/lib/format";

export function RatesBoard({
  offers,
  from,
  to,
  loading,
  city,
}: {
  offers: LiveOffer[];
  from: string;
  to: string;
  loading?: boolean;
  city?: string;
}) {
  const pinAds = useAds("rates");
  const pinKey = pinAds.map((a) => `${a.id}:${a.priority}`).join("|");
  const chosenPin = useMemo(
    () => pickWeightedRandom(pinAds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinKey],
  );
  const pinnedId = chosenPin?.exchangerId ?? null;
  const pinnedAdId = chosenPin?.id ?? null;

  useEffect(() => {
    if (pinnedAdId && pinnedId && offers.some((o) => o.exchanger?.id === pinnedId)) {
      trackAdImpression(pinnedAdId);
    }
  }, [pinnedAdId, pinnedId, offers]);

  const ordered = useMemo(() => {
    if (!pinnedId) return offers;
    const pinned = offers.filter((o) => o.exchanger?.id === pinnedId);
    const rest = offers.filter((o) => o.exchanger?.id !== pinnedId);
    return [...pinned, ...rest].map((offer, index) => ({
      ...offer,
      rank: index + 1,
    }));
  }, [offers, pinnedId]);

  const pairLabel = city
    ? `${from} → ${to} · ${cityLabel(city)}`
    : `${from} → ${to}`;

  return (
    <div className="card animate-rise-delay-2 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Лучшие предложения
          </h2>
          <p className="text-sm text-ink-muted">
            {loading
              ? "Загрузка…"
              : ordered.length
                ? `${pairLabel} · ${ordered.length} обменников · по убыванию курса`
                : `${pairLabel} · нет в мониторинге`}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
          <span className="live-dot size-2 rounded-full bg-ok" />
          XML-фиды
        </span>
      </div>

      {loading && !ordered.length ? (
        <div className="px-5 py-14 text-center text-sm text-ink-muted">
          Ищем обменники по направлению {pairLabel}…
        </div>
      ) : !ordered.length ? (
        <div className="px-5 py-14 text-center text-sm text-ink-muted">
          Ни один обменник пока не отдаёт направление {pairLabel}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Обменник</th>
                <th className="px-5 py-3 font-medium">Курс</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">
                  Резерв
                </th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">
                  Лимиты
                </th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((offer) => {
                const name = offer.exchanger?.name?.trim() || "Обменник";
                const slug = offer.exchanger?.slug || offer.exchanger?.id || "";
                const sponsored = offer.exchanger?.id === pinnedId;
                return (
                  <tr
                    key={offer.id}
                    className={`border-t border-line/70 transition hover:bg-accent-soft/40 ${
                      sponsored ? "bg-accent-soft/50" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {offer.exchanger.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={offer.exchanger.logoUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 rounded-2xl bg-bg-soft object-contain"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-xs font-bold text-white">
                            {name.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/exchangers/${slug}`}
                              className="font-semibold text-ink hover:text-accent"
                              onClick={() => {
                                if (sponsored && pinnedAdId) {
                                  trackAdClick(pinnedAdId);
                                }
                              }}
                            >
                              {name}
                            </Link>
                            <AchievementBadges
                              achievements={offer.exchanger.achievements ?? []}
                              size={16}
                            />
                            {sponsored ? (
                              <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                Реклама
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-ink-muted">
                            ★{" "}
                            {formatRating(
                              offer.exchanger.rating,
                              offer.exchanger.reviews,
                            )}{" "}
                            · {offer.exchanger.reviews} отз.
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold tabular-nums text-accent-deep">
                        {formatAmount(offer.rate, currencyDecimals(to))}
                      </span>{" "}
                      <span className="text-ink-muted">
                        {to} / 1 {from}
                      </span>
                    </td>
                    <td className="hidden px-5 py-4 tabular-nums text-ink-muted md:table-cell">
                      {formatReserve(offer.reserve, to)}
                    </td>
                    <td className="hidden px-5 py-4 tabular-nums text-ink-muted lg:table-cell">
                      {formatAmount(offer.minAmount, 4)} –{" "}
                      {Number.isFinite(offer.maxAmount)
                        ? formatAmount(offer.maxAmount, 4)
                        : "∞"}{" "}
                      {from}
                    </td>
                    <td className="px-5 py-4">
                      <a
                        href={offer.exchanger.website || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary inline-flex rounded-xl px-3 py-2 text-xs font-semibold"
                        onClick={() => {
                          if (sponsored && pinnedAdId) {
                            trackAdClick(pinnedAdId);
                          }
                        }}
                      >
                        Trade
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
