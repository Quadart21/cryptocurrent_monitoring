"use client";

import Link from "next/link";
import {
  CityAutocomplete,
  type CityOption,
} from "@/components/dashboard/CityAutocomplete";
import {
  amountPresetsFor,
} from "@/lib/bestchange/catalog-client-amount";
import {
  currencyOptionLabel,
  groupCurrencyOptions,
} from "@/lib/currency-display";
import {
  formatCurrencyAmount,
  formatRate,
} from "@/lib/format";

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
  popularPairs: [string, string][];
  bestRate?: number;
  offerCount: number;
  amount?: number;
  onAmountChange?: (n: number) => void;
  onModeChange: (mode: ExchangeMode) => void;
  onCityChange: (code: string) => void;
  onFromChange: (code: string) => void;
  onToChange: (code: string) => void;
  onPairChange: (from: string, to: string) => void;
  onSwap: () => void;
};

function CurrencySelect({
  label,
  value,
  exclude,
  options,
  onChange,
}: {
  label: string;
  value: string;
  exclude: string;
  options: CurrencyOption[];
  onChange: (code: string) => void;
}) {
  const filtered = options.filter((c) => c.code !== exclude);
  const groups = groupCurrencyOptions(filtered);
  const selected = filtered.some((c) => c.code === value)
    ? value
    : (filtered[0]?.code ?? "");

  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-2xl border border-line bg-input px-3 py-3 text-base font-medium text-ink outline-none focus:border-accent sm:text-sm"
      >
        {groups.map((group) => (
          <optgroup
            key={`${group.groupId}-${group.groupName}`}
            label={group.groupName}
          >
            {group.items.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function FastAction({
  mode,
  city,
  from,
  to,
  currencies,
  cities,
  popularPairs,
  bestRate,
  offerCount,
  amount = 0,
  onAmountChange,
  onModeChange,
  onCityChange,
  onFromChange,
  onToChange,
  onPairChange,
  onSwap,
}: Props) {
  const options =
    currencies.length > 0
      ? currencies
      : [
          { code: from, name: from, groupId: -1, groupName: "Другое" },
          { code: to, name: to, groupId: -1, groupName: "Другое" },
        ];

  const popular = popularPairs.slice(0, 5);
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
      <div className="border-b border-line px-3 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Мониторинг курсов
            </p>
            <h1 className="mt-1.5 font-display text-[1.35rem] font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
              Сравните курсы и выберите обменник
            </h1>
            <p className="mt-1.5 hidden max-w-2xl text-sm text-ink-muted sm:block">
              Выберите пару — ниже актуальные предложения с курсом, объёмом и
              рейтингом.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-line bg-bg-soft p-1">
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
                className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  mode === value
                    ? "bg-accent text-white"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-line bg-bg-soft px-3.5 py-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-ink-muted">
                  {estimate != null ? "Ориентир к получению" : "Лучший курс"}
                  {mode === "cash" && city ? ` · ${cityName}` : ""}
                </p>
                <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-accent-deep sm:text-2xl">
                  {estimate != null
                    ? formatCurrencyAmount(estimate, to)
                    : bestRate != null
                      ? formatRate(bestRate)
                      : "—"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                  {estimate != null
                    ? `${toName} за ${formatCurrencyAmount(amount, from)} ${fromName}`
                    : `${toName} за 1 ${fromName}`}
                </p>
              </div>
              <p className="shrink-0 rounded-xl bg-bg-elevated px-2.5 py-1.5 text-xs font-semibold tabular-nums text-ink">
                {offerCount > 0 ? `${offerCount} оф.` : "нет оф."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-5">
        {mode === "cash" ? (
          <div className="space-y-1.5">
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

        <div className="relative grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
          <CurrencySelect
            label="Отдаёте"
            value={from}
            exclude={to}
            options={options}
            onChange={onFromChange}
          />

          <div className="relative z-10 -my-1 flex justify-center sm:my-0 sm:pb-1">
            <button
              type="button"
              onClick={onSwap}
              className="flex h-11 min-w-[7.5rem] items-center justify-center gap-2 rounded-full border border-line bg-bg-elevated px-4 text-sm font-semibold text-accent shadow-sm transition hover:border-accent hover:bg-accent-soft sm:size-11 sm:min-w-0 sm:px-0 sm:text-base sm:shadow-none"
              aria-label="Поменять валюты местами"
            >
              <span className="sm:hidden">Поменять</span>
              <span aria-hidden>⇅</span>
            </button>
          </div>

          <CurrencySelect
            label="Получаете"
            value={to}
            exclude={from}
            options={options}
            onChange={onToChange}
          />
        </div>

        {onAmountChange ? (
          <div className="space-y-2 rounded-2xl border border-line bg-bg-soft/60 p-3 sm:p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <label className="block min-w-0 flex-1 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Калькулятор · сколько отдаёте
                </span>
                <div className="flex min-h-12 items-stretch overflow-hidden rounded-2xl border border-line bg-input focus-within:border-accent">
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
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold tabular-nums text-ink outline-none sm:text-sm"
                  />
                  <span className="flex shrink-0 items-center border-l border-line px-3 text-xs font-semibold text-ink-muted">
                    {fromName}
                  </span>
                </div>
              </label>
              {estimate != null ? (
                <div className="rounded-xl border border-accent/20 bg-accent-soft/50 px-3 py-2 sm:min-w-[11rem]">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                    Лучший получите ≈
                  </p>
                  <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-accent-deep">
                    {formatCurrencyAmount(estimate, to)}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted">{toName}</p>
                </div>
              ) : null}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onAmountChange(preset)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    amount === preset
                      ? "bg-accent text-white"
                      : "border border-line bg-bg-elevated text-ink-muted hover:text-ink"
                  }`}
                >
                  {formatCurrencyAmount(preset, from)}
                </button>
              ))}
              {amount > 0 ? (
                <button
                  type="button"
                  onClick={() => onAmountChange(0)}
                  className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 self-center text-xs text-ink-muted">
              Популярное:
            </span>
            {popular.map(([a, b]) => {
              const inList =
                options.some((c) => c.code === a) &&
                options.some((c) => c.code === b);
              if (!inList) return null;
              return (
                <button
                  key={`${a}-${b}`}
                  type="button"
                  onClick={() => onPairChange(a, b)}
                  title={`${a} → ${b}`}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${
                    from === a && to === b
                      ? "bg-accent text-white"
                      : "bg-accent-soft text-accent hover:brightness-110"
                  }`}
                >
                  {currencyOptionLabel(a, options)} →{" "}
                  {currencyOptionLabel(b, options)}
                </button>
              );
            })}
          </div>
          <Link
            href="/apply"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-ink-muted hover:text-accent-deep"
          >
            Владельцам обменников →
          </Link>
        </div>
      </div>
    </section>
  );
}
