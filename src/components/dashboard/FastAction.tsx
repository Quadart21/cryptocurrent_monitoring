"use client";

import Link from "next/link";
import {
  CityAutocomplete,
  type CityOption,
} from "@/components/dashboard/CityAutocomplete";
import { CurrencyAutocomplete } from "@/components/dashboard/CurrencyAutocomplete";
import { amountPresetsFor } from "@/lib/bestchange/catalog-client-amount";
import { currencyOptionLabel } from "@/lib/currency-display";
import { formatCurrencyAmount } from "@/lib/format";

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

  const fromName = currencyOptionLabel(from, options);
  const toName = currencyOptionLabel(to, options);
  const presets = amountPresetsFor(from);
  const estimate =
    amount > 0 && bestRate != null && Number.isFinite(bestRate)
      ? amount * bestRate
      : null;

  return (
    <section className="animate-rise space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[1.4rem] font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
            Курсы обмена
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {offerCount > 0
              ? `${offerCount} предложений по выбранной паре`
              : "Выберите пару — покажем актуальные предложения"}
          </p>
        </div>

        <div
          className="inline-flex shrink-0 self-start rounded-full border border-line bg-bg-elevated p-0.5 sm:self-auto"
          role="group"
          aria-label="Тип обмена"
        >
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
              className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${
                mode === value
                  ? "bg-ink text-bg-elevated"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "cash" ? (
        <div className="max-w-md">
          <CityAutocomplete
            cities={cities}
            value={city}
            onChange={onCityChange}
          />
        </div>
      ) : null}

      {/* Converter ticket — stacked give → get */}
      <div className="relative overflow-visible rounded-2xl border border-line bg-bg-elevated shadow-[var(--card-shadow)]">
        <div className="space-y-0 divide-y divide-line">
          <div className="p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Отдаёте
              </span>
              <span className="truncate text-xs text-ink-muted">{fromName}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] sm:items-center">
              <CurrencyAutocomplete
                value={from}
                exclude={to}
                options={options}
                onChange={onFromChange}
                placeholder="Валюта или код…"
                variant="plain"
              />
              {onAmountChange ? (
                <div className="flex min-h-11 items-stretch overflow-hidden rounded-xl bg-bg-soft focus-within:ring-1 focus-within:ring-accent">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder="Сумма"
                    value={amount || ""}
                    onChange={(e) =>
                      onAmountChange(Number(e.target.value) || 0)
                    }
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right text-lg font-semibold tabular-nums text-ink outline-none sm:text-xl"
                    aria-label="Сумма к обмену"
                  />
                  <span className="flex shrink-0 items-center pr-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {from}
                  </span>
                </div>
              ) : null}
            </div>
            {onAmountChange ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onAmountChange(preset)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      amount === preset
                        ? "bg-accent text-white"
                        : "text-ink-muted hover:bg-bg-soft hover:text-ink"
                    }`}
                  >
                    {formatCurrencyAmount(preset, from)}
                  </button>
                ))}
                {amount > 0 ? (
                  <button
                    type="button"
                    onClick={() => onAmountChange(0)}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-bg-soft hover:text-ink"
                  >
                    Сбросить
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="relative z-20">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex -translate-y-1/2 justify-center">
              <button
                type="button"
                onClick={onSwap}
                className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-line bg-bg-elevated text-base font-semibold text-accent shadow-sm transition hover:border-accent hover:bg-accent-soft"
                aria-label="Поменять валюты местами"
              >
                <span aria-hidden>⇅</span>
              </button>
            </div>
          </div>

          <div className="p-3 pt-5 sm:p-4 sm:pt-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Получаете
              </span>
              <span className="truncate text-xs text-ink-muted">{toName}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] sm:items-center">
              <CurrencyAutocomplete
                value={to}
                exclude={from}
                options={options}
                onChange={onToChange}
                placeholder="Валюта или код…"
                variant="plain"
              />
              <div className="flex min-h-11 items-center justify-end rounded-xl bg-accent-soft/40 px-3 py-2.5">
                {estimate != null ? (
                  <p className="text-right">
                    <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                      Лучший ≈
                    </span>
                    <span className="font-display text-lg font-semibold tabular-nums text-accent-deep sm:text-xl">
                      {formatCurrencyAmount(estimate, to)}
                    </span>
                    <span className="ml-1.5 text-xs font-semibold uppercase text-ink-muted">
                      {to}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">
                    {amount > 0 ? "Нет курса" : "Укажите сумму"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href="/apply"
          className="text-sm font-semibold text-ink-muted hover:text-accent-deep"
        >
          Владельцам обменников →
        </Link>
      </div>
    </section>
  );
}
