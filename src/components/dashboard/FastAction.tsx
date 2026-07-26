"use client";

import Link from "next/link";
import { POPULAR_FEED_PAIRS, currencyLabel } from "@/lib/bestchange/catalog";

type CurrencyOption = { code: string; name: string };

type Props = {
  from: string;
  to: string;
  currencies: CurrencyOption[];
  bestRate?: number;
  offerCount: number;
  onFromChange: (code: string) => void;
  onToChange: (code: string) => void;
  onPairChange: (from: string, to: string) => void;
  onSwap: () => void;
};

export function FastAction({
  from,
  to,
  currencies,
  bestRate,
  offerCount,
  onFromChange,
  onToChange,
  onPairChange,
  onSwap,
}: Props) {
  const options =
    currencies.length > 0
      ? currencies
      : [
          { code: from, name: currencyLabel(from) },
          { code: to, name: currencyLabel(to) },
        ];

  return (
    <div className="card animate-rise flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">
          Fast Action
        </h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
          {options.length} кодов
        </span>
      </div>

      <p className="mt-1 text-sm text-ink-muted">
        Выберите пару — обменники появятся сразу снизу
      </p>

      <div className="mt-5 space-y-3">
        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            Отдаёте
          </span>
          <select
            value={options.some((c) => c.code === from) ? from : options[0]?.code}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm font-medium text-ink outline-none focus:border-accent"
          >
            {options
              .filter((c) => c.code !== to)
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onSwap}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-bg-soft text-accent transition hover:border-accent hover:shadow-[var(--glow)]"
            aria-label="Поменять"
          >
            ⇅
          </button>
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            Получаете
          </span>
          <select
            value={
              options.some((c) => c.code === to)
                ? to
                : (options[1]?.code ?? options[0]?.code)
            }
            onChange={(e) => onToChange(e.target.value)}
            className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm font-medium text-ink outline-none focus:border-accent"
          >
            {options
              .filter((c) => c.code !== from)
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>

        <div className="rounded-2xl border border-line bg-bg-soft px-4 py-3">
          <p className="text-xs text-ink-muted">Лучший курс (за 1 {from})</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-accent-deep">
            {bestRate != null
              ? `${bestRate.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} ${to}`
              : "нет предложений"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {offerCount > 0
              ? `${offerCount} обменник(ов) ниже`
              : "Ни один обменник не отдаёт это направление"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {POPULAR_FEED_PAIRS.slice(0, 4).map(([a, b]) => (
            <button
              key={`${a}-${b}`}
              type="button"
              onClick={() => onPairChange(a, b)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                from === a && to === b
                  ? "bg-accent text-white"
                  : "bg-accent-soft text-accent"
              }`}
            >
              {a.replace(/TRC20|ERC20|BEP20/g, "")}→{b.replace(/RUB$/, "")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--promo-from)] to-[var(--promo-to)] p-4 text-white shadow-[var(--glow)]">
        <p className="font-display text-base font-semibold">Владелец обменника?</p>
        <p className="mt-1 text-sm text-white/85">
          Подключите valuta.xml и попадите в мониторинг.
        </p>
        <Link
          href="/apply"
          className="mt-3 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--accent-deep)]"
        >
          Upgrade Now
        </Link>
      </div>
    </div>
  );
}
