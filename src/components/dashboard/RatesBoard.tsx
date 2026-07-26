"use client";

import Link from "next/link";
import type { LiveOffer } from "@/components/RateTable";
import { currencyDecimals } from "@/lib/bestchange/catalog";
import { formatAmount, formatRating, formatReserve } from "@/lib/format";

export function RatesBoard({
  offers,
  from,
  to,
  loading,
}: {
  offers: LiveOffer[];
  from: string;
  to: string;
  loading?: boolean;
}) {
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
              : offers.length
                ? `${from} → ${to} · ${offers.length} обменников`
                : `${from} → ${to} · нет в мониторинге`}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
          <span className="live-dot size-2 rounded-full bg-ok" />
          XML-фиды
        </span>
      </div>

      {loading && !offers.length ? (
        <div className="px-5 py-14 text-center text-sm text-ink-muted">
          Ищем обменники по направлению {from} → {to}…
        </div>
      ) : !offers.length ? (
        <div className="px-5 py-14 text-center text-sm text-ink-muted">
          Ни один обменник пока не отдаёт направление {from} → {to}.
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
              {offers.map((offer) => (
                <tr
                  key={offer.id}
                  className="border-t border-line/70 transition hover:bg-accent-soft/40"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-xs font-bold text-white">
                        {offer.exchanger.name.slice(0, 1)}
                      </div>
                      <div>
                        <Link
                          href={`/exchangers/${offer.exchanger.slug}`}
                          className="font-semibold text-ink hover:text-accent"
                        >
                          {offer.exchanger.name}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          ★ {formatRating(offer.exchanger.rating)} ·{" "}
                          {offer.exchanger.reviews} отз.
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
                      href={offer.exchanger.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary inline-flex rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      Trade
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
