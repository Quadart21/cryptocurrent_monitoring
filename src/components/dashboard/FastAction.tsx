"use client";

import Link from "next/link";
import {
  CityAutocomplete,
  type CityOption,
} from "@/components/dashboard/CityAutocomplete";
import { CurrencyAutocomplete } from "@/components/dashboard/CurrencyAutocomplete";
import { amountPresetsFor } from "@/lib/bestchange/catalog-client-amount";
import { currencyOptionLabel } from "@/lib/currency-display";
import { formatCurrencyAmount, formatRate } from "@/lib/format";

export type ExchangeMode = "online" | "cash";

type CurrencyOption = {
  code: string;
  name: string;
  groupId?: number;
  groupName?: string;
};

type Props = {
  mode: ExchangeMode;
  city: string;
  from: string;
  to: string;
  currencies: CurrencyOption[];
  cities: CityOption[];
  bestRate?: number;
  offerCount: number;
  amount?: number;
  onAmountChange?: (n: number) => void;
  onModeChange: (mode: ExchangeMode) => void;
  onCityChange: (code: string) => void;
  onFromChange: (code: string) => void;
  onToChange: (code: string) => void;
  onSwap: () => void;
};

export function FastAction({
  mode,
  city,
  from,
  to,
  currencies,
  cities,
  bestRate,
  offerCount,
  amount = 0,
  onAmountChange,
  onModeChange,
  onCityChange,
  onFromChange,
  onToChange,
  onSwap,
}: Props) {
  const options =
    currencies.length > 0
      ? currencies
      : [
          { code: from, name: from, groupId: -1, groupName: "Другое" },
          { code: to, name: to, groupId: -1, groupName: "Другое" },
        ];

  const cityName = cities.find((c) => c.code === city)?.name ?? city;
  const fromName = currencyOptionLabel(from, options);
  const toName = currencyOptionLabel(to, options);
  const presets = amountPresetsFor(from);
  const estimate =
    amount > 0 && bestRate != null && Number.isFinite(bestRate)
      ? amount * bestRate
      : null;

  return (
    <section className="animate-rise overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-[var(--card-shadow)]">
      <div className="border-b border-line px-3 py-3.5 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Мониторинг курсов
            </p>
            <h1 className="mt-1 font-display text-[1.35rem] font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
              Сравните курсы и выберите обменник
            </h1>
            <p className="mt-1 hidden max-w-2xl text-sm text-ink-muted sm:block">
              Выберите пару — ниже актуальные предложения с курсом, объёмом и
              рейтингом.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-0.5 rounded-xl border border-line bg-bg-soft p-0.5">
            {(
              [
                ["online", "Онлайн"],
                ["cash", "Наличные"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                className={`min-h-9 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  mode === value
                    ? "bg-accent text-white"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg-soft px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] text-ink-muted">
                {estimate != null ? "Ориентир" : "Лучший курс"}
                {mode === "cash" && city ? ` · ${cityName}` : ""}
                {" · "}
                {estimate != null
                  ? `${toName} за ${formatCurrencyAmount(amount, from)} ${fromName}`
                  : `${toName} за 1 ${fromName}`}
              </p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums leading-none text-accent-deep sm:text-xl">
                {estimate != null
                  ? formatCurrencyAmount(estimate, to)
                  : bestRate != null
                    ? formatRate(bestRate)
                    : "—"}
              </p>
            </div>
            <p className="shrink-0 rounded-lg bg-bg-elevated px-2 py-1 text-xs font-semibold tabular-nums text-ink">
              {offerCount > 0 ? `${offerCount} оф.` : "нет оф."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 px-3 py-4 sm:px-6 sm:py-5">
        {mode === "cash" ? (
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Город
            </span>
            <CityAutocomplete
              cities={cities}
              value={city}
              onChange={onCityChange}
            />
          </div>
        ) : null}

        <div className="relative grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
          <CurrencyAutocomplete
            label="Отдаёте"
            value={from}
            exclude={to}
            options={options}
            onChange={onFromChange}
            placeholder="BTC, биткоин, Сбер…"
          />

          <div className="relative z-10 -my-0.5 flex justify-center sm:my-0 sm:pb-0.5">
            <button
              type="button"
              onClick={onSwap}
              className="flex h-10 min-w-[7rem] items-center justify-center gap-2 rounded-full border border-line bg-bg-elevated px-3 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent-soft sm:size-10 sm:min-w-0 sm:px-0 sm:shadow-none"
              aria-label="Поменять валюты местами"
            >
              <span className="sm:hidden">Поменять</span>
              <span aria-hidden>⇅</span>
            </button>
          </div>

          <CurrencyAutocomplete
            label="Получаете"
            value={to}
            exclude={from}
            options={options}
            onChange={onToChange}
            placeholder="USDT, доллар, Тинькофф…"
          />
        </div>

        {onAmountChange ? (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <label className="block min-w-0 flex-1 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Сумма
                </span>
                <div className="flex min-h-11 items-stretch overflow-hidden rounded-xl border border-line bg-input focus-within:border-accent">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount || ""}
                    onChange={(e) =>
                      onAmountChange(Number(e.target.value) || 0)
                    }
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base font-semibold tabular-nums text-ink outline-none sm:text-sm"
                  />
                  <span className="flex shrink-0 items-center border-l border-line px-3 text-xs font-semibold text-ink-muted">
                    {fromName}
                  </span>
                </div>
              </label>
              {estimate != null ? (
                <div className="flex min-h-11 items-center gap-2 rounded-xl px-1 sm:min-w-[10rem] sm:justify-end sm:px-0">
                  <div className="min-w-0 text-left sm:text-right">
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                      Получите ≈
                    </p>
                    <p className="font-display text-base font-semibold tabular-nums text-accent-deep sm:text-lg">
                      {formatCurrencyAmount(estimate, to)}
                      <span className="ml-1 text-xs font-semibold text-ink-muted">
                        {toName}
                      </span>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onAmountChange(preset)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    amount === preset
                      ? "bg-accent text-white"
                      : "border border-line text-ink-muted hover:text-ink"
                  }`}
                >
                  {formatCurrencyAmount(preset, from)}
                </button>
              ))}
              {amount > 0 ? (
                <button
                  type="button"
                  onClick={() => onAmountChange(0)}
                  className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <Link
          href="/apply"
          className="inline-flex min-h-9 items-center text-sm font-semibold text-ink-muted hover:text-accent-deep"
        >
          Владельцам обменников →
        </Link>
      </div>
    </section>
  );
}
