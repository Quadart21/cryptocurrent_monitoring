"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  POPULAR_FEED_PAIRS,
  defaultAmountFor,
} from "@/lib/bestchange/catalog";
import { RateTable, type LiveOffer } from "@/components/RateTable";

type CurrencyOption = { code: string; name: string };

function CurrencySelect({
  id,
  value,
  onChange,
  options,
  exclude,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  options: CurrencyOption[];
  exclude?: string;
}) {
  const list = options.filter((c) => c.code !== exclude);
  return (
    <select
      id={id}
      value={list.some((c) => c.code === value) ? value : list[0]?.code ?? value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-lg border border-line bg-bg-elevated px-3 py-3 text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
    >
      {list.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} — {c.name}
        </option>
      ))}
    </select>
  );
}

export function ExchangeMonitor() {
  const [from, setFrom] = useState("USDTTRC20");
  const [to, setTo] = useState("SBERRUB");
  const [amount, setAmount] = useState(String(defaultAmountFor("USDTTRC20")));
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pairBootstrapped = useRef(false);

  const amountNum = Number(String(amount).replace(",", ".")) || 0;

  const loadRates = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        from,
        to,
        amount: String(amountNum),
      });
      const res = await fetch(`/api/rates?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить курсы");
      const data = (await res.json()) as {
        currencies: CurrencyOption[];
        offers: LiveOffer[];
        lastGlobalSyncAt: string | null;
      };

      setCurrencies(data.currencies);
      setLastSyncAt(data.lastGlobalSyncAt);
      setError(null);

      let next = data.offers;
      if (onlineOnly) {
        next = next.filter((o) => o.exchanger.status === "online");
      }
      setOffers(next);

      if (!pairBootstrapped.current && data.currencies.length) {
        const codes = new Set(data.currencies.map((c) => c.code));
        if (!codes.has(from) || !codes.has(to)) {
          const preferred = POPULAR_FEED_PAIRS.find(
            ([a, b]) => codes.has(a) && codes.has(b),
          );
          if (preferred) {
            setFrom(preferred[0]);
            setTo(preferred[1]);
            setAmount(String(defaultAmountFor(preferred[0])));
          } else if (data.currencies.length >= 2) {
            setFrom(data.currencies[0].code);
            setTo(data.currencies[1].code);
            setAmount(String(defaultAmountFor(data.currencies[0].code)));
          }
        }
        pairBootstrapped.current = true;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [from, to, amountNum, onlineOnly]);

  useEffect(() => {
    void loadRates();
    const id = setInterval(() => void loadRates(), 60_000);
    return () => clearInterval(id);
  }, [loadRates]);

  function swapDirections() {
    setFrom(to);
    setTo(from);
    setAmount(String(defaultAmountFor(to)));
  }

  function applyPair(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setAmount(String(defaultAmountFor(nextFrom)));
  }

  const popular = POPULAR_FEED_PAIRS.filter(([a, b]) => {
    const codes = new Set(currencies.map((c) => c.code));
    return codes.size === 0 || (codes.has(a) && codes.has(b));
  });

  const syncLabel = lastSyncAt
    ? `Обновлено ${new Date(lastSyncAt).toLocaleTimeString("ru-RU")}`
    : "Ожидание первой синхронизации";

  return (
    <section className="space-y-8">
      <div className="animate-rise-delay-1 rounded-2xl border border-line/80 bg-bg-elevated/90 p-4 shadow-[0_20px_50px_-28px_rgba(15,60,45,0.35)] sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_1.1fr] lg:items-end">
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Отдаёте
            </span>
            <CurrencySelect
              id="from"
              value={from}
              options={
                currencies.length ? currencies : [{ code: from, name: from }]
              }
              onChange={(code) => {
                setFrom(code);
                setAmount(String(defaultAmountFor(code)));
              }}
              exclude={to}
            />
          </label>

          <button
            type="button"
            onClick={swapDirections}
            aria-label="Поменять направления"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-accent-deep transition hover:border-accent hover:bg-accent-soft lg:mb-0.5"
          >
            ⇄
          </button>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Получаете
            </span>
            <CurrencySelect
              id="to"
              value={to}
              options={currencies.length ? currencies : [{ code: to, name: to }]}
              onChange={setTo}
              exclude={from}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Сумма
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-3 text-sm font-semibold tabular-nums text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {popular.map(([a, b]) => {
              const active = from === a && to === b;
              return (
                <button
                  key={`${a}-${b}`}
                  type="button"
                  onClick={() => applyPair(a, b)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-accent text-white"
                      : "bg-accent-soft/70 text-accent-deep hover:bg-accent-soft"
                  }`}
                >
                  {a.replace(/TRC20|ERC20|BEP20/g, "")} →{" "}
                  {b.replace(/RUB$/, "")}
                </button>
              );
            })}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(e) => setOnlineOnly(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Только онлайн
          </label>
        </div>
      </div>

      <div className="animate-rise-delay-2">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              Лучшие курсы
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {loading
                ? "Загрузка курсов из XML-фидов…"
                : error
                  ? error
                  : offers.length
                    ? `${offers.length} предложений · ${from} → ${to}`
                    : `Нет предложений для ${from} → ${to}`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="live-dot inline-block size-2 rounded-full bg-accent" />
            {syncLabel}
          </div>
        </div>
        <RateTable offers={offers} amount={amountNum} from={from} to={to} />
      </div>
    </section>
  );
}
