"use client";

import Link from "next/link";
import {
  CityAutocomplete,
  type CityOption,
} from "@/components/dashboard/CityAutocomplete";
import {
  currencyOptionLabel,
  groupCurrencyOptions,
} from "@/lib/currency-display";
import { formatRate } from "@/lib/format";

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
    <label className="block space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-line bg-input px-3 py-3 text-sm font-medium text-ink outline-none focus:border-accent"
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

  const popular = popularPairs.slice(0, 4);

  const cityName = cities.find((c) => c.code === city)?.name ?? city;
  const fromName = currencyOptionLabel(from, options);
  const toName = currencyOptionLabel(to, options);

  return (
    <div className="card animate-rise flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-ink">
          Быстрый обмен
        </h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
          {options.length}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-bg-soft p-1">
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
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              mode === value
                ? "bg-accent text-white shadow-[var(--glow)]"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-ink-muted">
        {mode === "cash"
          ? "Город и наличный фиат — без банковских карт и счетов"
          : "Онлайн-обмен без наличных — обменники ниже"}
      </p>

      <div className="mt-5 space-y-3">
        {mode === "cash" && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Город
            </span>
            <CityAutocomplete
              cities={cities}
              value={city}
              onChange={onCityChange}
            />
          </div>
        )}

        <CurrencySelect
          label="Отдаёте"
          value={from}
          exclude={to}
          options={options}
          onChange={onFromChange}
        />

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

        <CurrencySelect
          label="Получаете"
          value={to}
          exclude={from}
          options={options}
          onChange={onToChange}
        />

        <div className="rounded-2xl border border-line bg-bg-soft px-4 py-3">
          <p className="text-xs text-ink-muted">
            Лучший курс (за 1 {fromName})
            {mode === "cash" && city ? ` · ${cityName}` : ""}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-accent-deep">
            {bestRate != null
              ? `${formatRate(bestRate)} ${toName}`
              : "нет предложений"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {offerCount > 0
              ? `${offerCount} обменник(ов) ниже`
              : "Ни один обменник не отдаёт это направление"}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
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
                className={`max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  from === a && to === b
                    ? "bg-accent text-white"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {currencyOptionLabel(a, options)} →{" "}
                {currencyOptionLabel(b, options)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--promo-from)] to-[var(--promo-to)] p-4 text-white shadow-[var(--glow)]">
        <p className="font-display text-base font-semibold">
          Владелец обменника?
        </p>
        <p className="mt-1 text-sm text-white/85">
          Подключите valuta.xml и попадите в мониторинг.
        </p>
        <Link
          href="/apply"
          className="mt-3 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--accent-deep)]"
        >
          Подать заявку
        </Link>
      </div>
    </div>
  );
}
