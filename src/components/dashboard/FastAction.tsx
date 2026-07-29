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
    <label className="block min-w-0 space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
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

  const popular = popularPairs.slice(0, 5);
  const cityName = cities.find((c) => c.code === city)?.name ?? city;
  const fromName = currencyOptionLabel(from, options);
  const toName = currencyOptionLabel(to, options);

  return (
    <section className="animate-rise overflow-hidden rounded-[1.75rem] border border-line bg-bg-elevated shadow-[var(--card-shadow)]">
      <div className="relative border-b border-line/70 px-4 py-4 sm:px-6 sm:py-5">
        <div
          className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] opacity-20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
              GapSnap · мониторинг
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Сравните курсы и выберите обменник
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">
              Выберите пару — ниже актуальные предложения с курсом, резервом и
              рейтингом.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-bg-soft p-1">
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
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    mode === value
                      ? "bg-accent text-white shadow-[var(--glow)]"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-bg-soft px-3 py-2 text-sm">
              <p className="text-[11px] text-ink-muted">
                Лучший курс
                {mode === "cash" && city ? ` · ${cityName}` : ""}
              </p>
              <p className="font-semibold tabular-nums text-accent-deep">
                {bestRate != null
                  ? `${formatRate(bestRate)} ${toName}`
                  : "—"}
              </p>
              <p className="text-[11px] text-ink-muted">
                за 1 {fromName}
                {offerCount > 0 ? ` · ${offerCount} оф.` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        <div
          className={`grid gap-3 ${
            mode === "cash"
              ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto_minmax(0,1.1fr)]"
              : "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
          } lg:items-end`}
        >
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

          <CurrencySelect
            label="Отдаёте"
            value={from}
            exclude={to}
            options={options}
            onChange={onFromChange}
          />

          <div className="flex justify-center lg:pb-1">
            <button
              type="button"
              onClick={onSwap}
              className="flex size-11 items-center justify-center rounded-full border border-line bg-bg-soft text-accent transition hover:border-accent hover:shadow-[var(--glow)]"
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Популярное:</span>
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
                className={`max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
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
          <Link
            href="/apply"
            className="ml-auto text-xs font-semibold text-ink-muted hover:text-accent-deep"
          >
            Владельцам обменников →
          </Link>
        </div>
      </div>
    </section>
  );
}
