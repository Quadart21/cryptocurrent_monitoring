"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { AchievementBadges } from "@/components/AchievementBadges";
import { useAds } from "@/components/ads/useAds";
import { trackAdClick, trackAdImpression } from "@/components/ads/track";
import type { LiveOffer } from "@/components/RateTable";
import { pairPath } from "@/lib/bestchange/pair-slug";
import { adMatchesPair, pickWeightedRandom } from "@/lib/ads";
import { buildExchangeUrl } from "@/lib/exchange-link";
import {
  formatCurrencyAmount,
  formatRate,
  formatRating,
  formatVolumeLimits,
} from "@/lib/format";
import { currencyOptionLabel } from "@/lib/currency-display";

export type RatesSortBy = "rate" | "volume" | "rating";

export type RatesBoardReview = {
  id: string;
  exchangerName: string;
  exchangerSlug: string;
  sentiment: string;
  text: string;
  createdAt: string;
};

export function RatesBoard({
  offers,
  from,
  to,
  currencies = [],
  loading,
  cityLabel,
  amount = 0,
  onAmountChange,
  sortBy = "rate",
  onSortChange,
  recentReviews = [],
}: {
  offers: LiveOffer[];
  from: string;
  to: string;
  /** Used to show currency names instead of raw feed codes. */
  currencies?: Array<{ code: string; name: string }>;
  loading?: boolean;
  cityLabel?: string;
  amount?: number;
  onAmountChange?: (n: number) => void;
  sortBy?: RatesSortBy;
  onSortChange?: (s: RatesSortBy) => void;
  recentReviews?: RatesBoardReview[];
}) {
  const fromName = currencyOptionLabel(from, currencies);
  const toName = currencyOptionLabel(to, currencies);
  const pinAds = useAds("rates");
  const scopedPinAds = useMemo(
    () => pinAds.filter((ad) => adMatchesPair(ad, from, to)),
    [pinAds, from, to],
  );
  const pinKey = scopedPinAds.map((a) => `${a.id}:${a.priority}`).join("|");
  const chosenPin = useMemo(
    () => pickWeightedRandom(scopedPinAds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinKey],
  );
  const pinnedId = chosenPin?.exchangerId ?? null;
  const pinnedAdId = chosenPin?.id ?? null;

  const sorted = useMemo(() => {
    const list = [...offers];
    list.sort((a, b) => {
      if (sortBy === "volume") {
        const maxA = Number.isFinite(a.maxAmount) ? a.maxAmount : 0;
        const maxB = Number.isFinite(b.maxAmount) ? b.maxAmount : 0;
        if (maxB !== maxA) return maxB - maxA;
      }
      if (sortBy === "rating") {
        const d = (b.exchanger?.rating ?? 0) - (a.exchanger?.rating ?? 0);
        if (d !== 0) return d;
      }
      if (b.rate !== a.rate) return b.rate - a.rate;
      return (a.exchanger?.name ?? "").localeCompare(
        b.exchanger?.name ?? "",
        "ru",
      );
    });
    return list;
  }, [offers, sortBy]);

  useEffect(() => {
    if (pinnedAdId && pinnedId && sorted.some((o) => o.exchanger?.id === pinnedId)) {
      trackAdImpression(pinnedAdId);
    }
  }, [pinnedAdId, pinnedId, sorted]);

  const ordered = useMemo(() => {
    if (!pinnedId) {
      return sorted.map((offer, index) => ({ ...offer, rank: index + 1 }));
    }
    const pinned = sorted.filter((o) => o.exchanger?.id === pinnedId);
    const rest = sorted.filter((o) => o.exchanger?.id !== pinnedId);
    return [...pinned, ...rest].map((offer, index) => ({
      ...offer,
      rank: index + 1,
    }));
  }, [sorted, pinnedId]);

  const pairLabel = cityLabel
    ? `${fromName} → ${toName} · ${cityLabel}`
    : `${fromName} → ${toName}`;

  function onExchangeClick(sponsored: boolean) {
    if (sponsored && pinnedAdId) trackAdClick(pinnedAdId);
  }

  function receiveFor(rate: number) {
    return amount > 0 ? amount * rate : rate;
  }

  /** Unit rate when amount is empty; otherwise currency amount. */
  function formatReceiveValue(value: number) {
    return amount > 0 ? formatCurrencyAmount(value, to) : formatRate(value);
  }

  function volumeFor(offer: LiveOffer) {
    return formatVolumeLimits(offer.minAmount, offer.maxAmount, from);
  }

  function isWarned(offer: LiveOffer) {
    return offer.exchanger.reviews > 0 && offer.exchanger.rating > 0 && offer.exchanger.rating < 3;
  }

  return (
    <div className="card animate-rise-delay-2 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0 space-y-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Лучшие предложения
          </h2>
          <p className="mt-0.5 break-words text-sm text-ink-muted">
            {loading
              ? "Загрузка…"
              : ordered.length
                ? `${pairLabel} · ${ordered.length} обменников`
                : `${pairLabel} · нет в мониторинге`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={pairPath(from, to)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Страница пары →
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {onAmountChange ? (
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Сумма ({fromName})
              <input
                type="number"
                min={0}
                step="any"
                value={amount || ""}
                onChange={(e) =>
                  onAmountChange(Number(e.target.value) || 0)
                }
                className="w-32 rounded-xl border border-line bg-input px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
          ) : null}
          {onSortChange ? (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["rate", "Курс"],
                  ["volume", "Объём"],
                  ["rating", "Рейтинг"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSortChange(id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                    sortBy === id
                      ? "bg-accent text-white"
                      : "border border-line text-ink-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {loading && !ordered.length ? (
        <div className="px-4 py-14 text-center text-sm text-ink-muted sm:px-5">
          Ищем обменники по направлению {pairLabel}…
        </div>
      ) : !ordered.length ? (
        <div className="px-4 py-14 text-center text-sm text-ink-muted sm:px-5">
          Ни один обменник пока не отдаёт направление {pairLabel}.
        </div>
      ) : (
        <>
          <div className="divide-y divide-line md:hidden">
            {ordered.map((offer) => {
              const name = offer.exchanger?.name?.trim() || "Обменник";
              const slug = offer.exchanger?.slug || offer.exchanger?.id || "";
              const sponsored = offer.exchanger?.id === pinnedId;
              const receive = receiveFor(offer.rate);
              const volume = volumeFor(offer);
              return (
                <div
                  key={offer.id}
                  className={`space-y-3 px-4 py-4 ${
                    sponsored ? "bg-accent-soft/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {offer.exchanger.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={offer.exchanger.logoUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 shrink-0 rounded-2xl bg-bg-soft object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xs font-bold text-white">
                        {name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/exchangers/${slug}`}
                          className="truncate font-semibold text-ink hover:text-accent"
                          onClick={() => onExchangeClick(sponsored)}
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
                      <p className="mt-0.5 text-xs text-ink-muted">
                        ★{" "}
                        {formatRating(
                          offer.exchanger.rating,
                          offer.exchanger.reviews,
                        )}{" "}
                        · {offer.exchanger.reviews} отз.
                      </p>
                      {isWarned(offer) ? (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          Много жалоб — будьте осторожны
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-bg-soft/60 px-3 py-2">
                      <p className="text-[11px] text-ink-muted">Получите</p>
                      <p className="font-semibold tabular-nums text-accent-deep">
                        {formatReceiveValue(receive)} {toName}
                      </p>
                    </div>
                    <div className="rounded-xl bg-bg-soft/60 px-3 py-2">
                      <p className="text-[11px] text-ink-muted">
                        Объём ({fromName})
                      </p>
                      {volume ? (
                        <p className="font-medium tabular-nums text-ink">
                          от {volume.from}
                          <br />
                          до {volume.to}
                        </p>
                      ) : (
                        <p className="font-medium text-ink-muted">—</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/exchangers/${slug}`}
                      className="flex-1 rounded-xl border border-line px-3 py-2.5 text-center text-sm font-semibold text-ink-muted"
                    >
                      Подробнее
                    </Link>
                    <a
                      href={buildExchangeUrl(
                        offer.exchanger.exchangeUrlTemplate,
                        offer.exchanger.website,
                        offer.from,
                        offer.to,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary flex flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold"
                      onClick={() => onExchangeClick(sponsored)}
                    >
                      Обменять
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Обменник</th>
                  <th className="px-5 py-3 font-medium">
                    {amount > 0 ? "Получите" : "Курс"}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    Объём ({fromName})
                  </th>
                  <th className="px-5 py-3 font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((offer) => {
                  const name = offer.exchanger?.name?.trim() || "Обменник";
                  const slug = offer.exchanger?.slug || offer.exchanger?.id || "";
                  const sponsored = offer.exchanger?.id === pinnedId;
                  const receive = receiveFor(offer.rate);
                  const volume = volumeFor(offer);
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
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-xs font-bold text-white">
                              {name.slice(0, 1)}
                            </div>
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                href={`/exchangers/${slug}`}
                                className="font-semibold text-ink hover:text-accent"
                                onClick={() => onExchangeClick(sponsored)}
                              >
                                {name}
                              </Link>
                              <AchievementBadges
                                achievements={
                                  offer.exchanger.achievements ?? []
                                }
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
                            {isWarned(offer) ? (
                              <p className="text-xs font-semibold text-danger">
                                Много жалоб
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold tabular-nums text-accent-deep">
                          {formatReceiveValue(receive)}
                        </span>{" "}
                        <span className="text-ink-muted">{toName}</span>
                        {amount > 0 ? (
                          <p className="text-[11px] text-ink-muted">
                            курс {formatRate(offer.rate)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 tabular-nums text-ink-muted">
                        {volume ? (
                          <span>
                            от {volume.from}
                            <br />
                            до {volume.to}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/exchangers/${slug}`}
                            className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                          >
                            Подробнее
                          </Link>
                          <a
                            href={buildExchangeUrl(
                              offer.exchanger.exchangeUrlTemplate,
                              offer.exchanger.website,
                              offer.from,
                              offer.to,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary inline-flex rounded-xl px-3 py-2 text-xs font-semibold"
                            onClick={() => onExchangeClick(sponsored)}
                          >
                            Обменять
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {recentReviews.length > 0 ? (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <h3 className="text-sm font-semibold text-ink">Свежие отзывы</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {recentReviews.slice(0, 3).map((r) => (
              <Link
                key={r.id}
                href={`/exchangers/${r.exchangerSlug}`}
                className="rounded-2xl border border-line p-3 hover:border-accent/40"
              >
                <p className="text-xs font-semibold text-ink">
                  {r.exchangerName}{" "}
                  <span className="font-normal text-ink-muted">
                    · {r.sentiment === "positive" ? "плюс" : "минус"}
                  </span>
                </p>
                <p className="mt-1 line-clamp-3 text-xs text-ink-muted">
                  {r.text}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
