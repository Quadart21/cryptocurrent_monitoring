"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AchievementBadges } from "@/components/AchievementBadges";
import { useAds } from "@/components/ads/useAds";
import { trackAdClick, trackAdImpression } from "@/components/ads/track";
import type { LiveOffer } from "@/components/RateTable";
import {
  amountPresetsFor,
  offerFitsAmount,
} from "@/lib/bestchange/catalog-client-amount";
import { pairPath } from "@/lib/bestchange/pair-slug";
import { adMatchesPair, pickWeightedRandom } from "@/lib/ads";
import { buildExchangeUrl } from "@/lib/exchange-link";
import {
  formatCurrencyAmount,
  formatRate,
  formatRating,
  formatReserve,
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
  /** When true, amount input is shown here (pair pages). Homepage uses FastAction. */
  showAmountControl = true,
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
  showAmountControl?: boolean;
}) {
  const fromName = currencyOptionLabel(from, currencies);
  const toName = currencyOptionLabel(to, currencies);
  const [onlyFit, setOnlyFit] = useState(false);
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
  const presets = useMemo(() => amountPresetsFor(from), [from]);

  const sorted = useMemo(() => {
    const list = [...offers];
    list.sort((a, b) => {
      if (amount > 0) {
        const fitA = offerFitsAmount(amount, a).ok ? 1 : 0;
        const fitB = offerFitsAmount(amount, b).ok ? 1 : 0;
        if (fitB !== fitA) return fitB - fitA;
        const recvA = amount * a.rate;
        const recvB = amount * b.rate;
        if (recvB !== recvA) return recvB - recvA;
      }
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
  }, [offers, sortBy, amount]);

  useEffect(() => {
    if (pinnedAdId && pinnedId && sorted.some((o) => o.exchanger?.id === pinnedId)) {
      trackAdImpression(pinnedAdId);
    }
  }, [pinnedAdId, pinnedId, sorted]);

  const ordered = useMemo(() => {
    const base =
      amount > 0 && onlyFit
        ? sorted.filter((o) => offerFitsAmount(amount, o).ok)
        : sorted;
    if (!pinnedId) {
      return base.map((offer, index) => ({ ...offer, rank: index + 1 }));
    }
    const pinned = base.filter((o) => o.exchanger?.id === pinnedId);
    const rest = base.filter((o) => o.exchanger?.id !== pinnedId);
    return [...pinned, ...rest].map((offer, index) => ({
      ...offer,
      rank: index + 1,
    }));
  }, [sorted, pinnedId, amount, onlyFit]);

  const fitCount = useMemo(() => {
    if (!(amount > 0)) return offers.length;
    return offers.filter((o) => offerFitsAmount(amount, o).ok).length;
  }, [offers, amount]);

  const pairLabel = cityLabel
    ? `${fromName} → ${toName} · ${cityLabel}`
    : `${fromName} → ${toName}`;

  function onExchangeClick(sponsored: boolean) {
    if (sponsored && pinnedAdId) trackAdClick(pinnedAdId);
  }

  function receiveFor(rate: number) {
    return amount > 0 ? amount * rate : rate;
  }

  function volumeFor(offer: LiveOffer) {
    return formatVolumeLimits(offer.minAmount, offer.maxAmount, from);
  }

  function giveLabel(offer: LiveOffer) {
    if (amount > 0) {
      return `${formatCurrencyAmount(amount, from)} ${fromName}`;
    }
    return `1 ${fromName}`;
  }

  function reserveLabel(offer: LiveOffer) {
    if (!Number.isFinite(offer.reserve) || offer.reserve <= 0) return "—";
    return formatReserve(offer.reserve, toName);
  }

  function fitMeta(offer: LiveOffer) {
    return offerFitsAmount(amount, offer);
  }

  function fitHint(offer: LiveOffer): string | null {
    const { ok, reason } = fitMeta(offer);
    if (ok || !reason) return null;
    if (reason === "min") {
      return `Мин. ${formatCurrencyAmount(offer.minAmount, from)} ${fromName}`;
    }
    if (reason === "max") {
      return `Макс. ${formatCurrencyAmount(offer.maxAmount, from)} ${fromName}`;
    }
    return "Мало резерва";
  }

  function isWarned(offer: LiveOffer) {
    return offer.exchanger.reviews > 0 && offer.exchanger.rating > 0 && offer.exchanger.rating < 3;
  }

  function exchangeHref(offer: LiveOffer) {
    return buildExchangeUrl(
      offer.exchanger.exchangeUrlTemplate,
      offer.exchanger.website,
      offer.from,
      offer.to,
    );
  }

  return (
    <div className="card animate-rise-delay-2 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-3 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0 space-y-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Лучшие предложения
          </h2>
          <p className="mt-0.5 break-words text-sm text-ink-muted">
            {loading
              ? "Загрузка…"
              : ordered.length
                ? amount > 0
                  ? `${pairLabel} · ${fitCount} из ${offers.length} подходят под сумму`
                  : `${pairLabel} · ${ordered.length} обменников`
                : `${pairLabel} · нет в мониторинге`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={pairPath(from, to)}
              className="inline-flex min-h-10 items-center text-sm font-semibold text-accent hover:underline"
            >
              Страница пары →
            </Link>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          {showAmountControl && onAmountChange ? (
            <div className="w-full space-y-2 sm:w-72">
              <label className="flex w-full flex-col gap-1.5 text-xs text-ink-muted">
                Калькулятор · отдаёте ({fromName})
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={amount || ""}
                  onChange={(e) =>
                    onAmountChange(Number(e.target.value) || 0)
                  }
                  className="min-h-11 w-full rounded-xl border border-line bg-input px-3 py-2 text-base text-ink outline-none focus:border-accent sm:text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onAmountChange(preset)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      amount === preset
                        ? "bg-accent text-white"
                        : "border border-line text-ink-muted"
                    }`}
                  >
                    {formatCurrencyAmount(preset, from)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {amount > 0 ? (
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-ink-muted">
              <input
                type="checkbox"
                checked={onlyFit}
                onChange={(e) => setOnlyFit(e.target.checked)}
                className="size-4 rounded border-line accent-[var(--accent)]"
              />
              Только подходящие ({fitCount})
            </label>
          ) : null}
          {onSortChange ? (
            <div className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto sm:flex-wrap">
              {(
                [
                  ["rate", amount > 0 ? "Сумма" : "Курс"],
                  ["volume", "Объём"],
                  ["rating", "Рейтинг"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSortChange(id)}
                  className={`min-h-10 rounded-xl px-2.5 py-2 text-xs font-semibold sm:min-h-0 sm:rounded-lg sm:py-1 sm:text-[11px] ${
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
      ) : !ordered.length && offers.length > 0 && onlyFit ? (
        <div className="px-4 py-12 text-center sm:px-5">
          <p className="text-sm text-ink-muted">
            Нет предложений под сумму{" "}
            <span className="font-medium text-ink">
              {formatCurrencyAmount(amount, from)} {fromName}
            </span>
            . Снимите фильтр или измените сумму.
          </p>
          <button
            type="button"
            onClick={() => setOnlyFit(false)}
            className="mt-4 inline-flex min-h-10 items-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            Показать все
          </button>
        </div>
      ) : !ordered.length ? (
        <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-5 sm:py-14">
          <p className="text-sm leading-relaxed text-ink-muted">
            Пока никто не отдаёт направление{" "}
            <span className="font-medium text-ink">{pairLabel}</span>.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Есть обменник с этим направлением? Станьте первым в мониторинге —
            заявки заметят раньше остальных.
          </p>
          <Link
            href="/apply"
            className="btn-primary mt-5 inline-flex min-h-10 items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold"
          >
            Добавить обменник
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5 px-3 py-3 md:px-5 md:py-4">
          {ordered.map((offer) => {
            const name = offer.exchanger?.name?.trim() || "Обменник";
            const slug = offer.exchanger?.slug || offer.exchanger?.id || "";
            const sponsored = offer.exchanger?.id === pinnedId;
            const volume = volumeFor(offer);
            const href = exchangeHref(offer);
            const fit = fitMeta(offer);
            const hint = fitHint(offer);
            return (
              <article
                key={offer.id}
                className={`overflow-hidden rounded-2xl border transition md:flex md:items-stretch ${
                  sponsored
                    ? "border-accent/25 bg-accent-soft/25 shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--accent)_12%,transparent)]"
                    : "border-line/70 bg-bg-elevated/50"
                } ${amount > 0 && !fit.ok ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-2 md:w-[min(300px,34%)] md:shrink-0 md:border-r md:border-line/50 md:px-4 md:py-4">
                  {offer.exchanger.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={offer.exchanger.logoUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="size-11 shrink-0 rounded-xl bg-bg-soft object-contain ring-1 ring-line/60"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
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
                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                          Реклама
                        </span>
                      ) : null}
                      {hint ? (
                        <span className="rounded-md bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--warn)]">
                          {hint}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      ★{" "}
                      {formatRating(
                        offer.exchanger.rating,
                        offer.exchanger.reviews,
                      )}{" "}
                      · {offer.exchanger.reviews} отзывов
                    </p>
                    {isWarned(offer) ? (
                      <p className="mt-1 text-xs font-medium text-danger">
                        Много жалоб — будьте осторожны
                      </p>
                    ) : null}
                  </div>
                </div>

                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mx-3.5 mb-3.5 block flex-1 overflow-hidden rounded-xl border border-line/60 bg-bg-soft/40 transition hover:border-accent/30 active:bg-accent-soft/30 md:mx-0 md:my-3 md:mr-3 md:flex md:items-center md:rounded-xl"
                  onClick={() => onExchangeClick(sponsored)}
                >
                  <div className="grid w-full grid-cols-3 divide-x divide-line/50 text-center text-sm md:text-left">
                    <div className="px-2 py-2.5 md:px-5 md:py-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                        Отдаете
                      </p>
                      <p className="mt-0.5 text-xs font-medium tabular-nums leading-snug text-ink md:text-sm">
                        {giveLabel(offer)}
                      </p>
                      {volume ? (
                        <p className="mt-1 text-[9px] leading-tight text-ink-muted md:text-[11px]">
                          {volume.from}–{volume.to}
                        </p>
                      ) : null}
                    </div>
                    <div className="px-2 py-2.5 md:px-5 md:py-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                        Получаете
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums leading-snug text-accent-deep">
                        {amount > 0
                          ? formatCurrencyAmount(receiveFor(offer.rate), to)
                          : formatRate(offer.rate)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink-muted md:text-xs">
                        {toName}
                        {amount > 0
                          ? ` · курс ${formatRate(offer.rate)}`
                          : ""}
                      </p>
                    </div>
                    <div className="px-2 py-2.5 md:px-5 md:py-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                        Резерв
                      </p>
                      <p className="mt-0.5 text-xs font-medium tabular-nums leading-snug text-ink-muted md:text-sm">
                        {reserveLabel(offer)}
                      </p>
                    </div>
                  </div>
                </a>
              </article>
            );
          })}
        </div>
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
