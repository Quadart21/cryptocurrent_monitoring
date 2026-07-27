"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchExchanger = {
  id: string;
  slug: string;
  name: string;
  rating: number;
  status: string;
};

type SearchCurrency = {
  code: string;
  name: string;
  cash: boolean;
};

type SearchPair = {
  from: string;
  to: string;
  mode: "online" | "cash";
  label: string;
};

type SearchResult = {
  exchangers: SearchExchanger[];
  currencies: SearchCurrency[];
  pairs: SearchPair[];
};

type FlatItem =
  | { kind: "exchanger"; data: SearchExchanger }
  | { kind: "currency"; data: SearchCurrency }
  | { kind: "pair"; data: SearchPair };

export function GlobalSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult>({
    exchangers: [],
    currencies: [],
    pairs: [],
  });
  const [active, setActive] = useState(0);
  const reqId = useRef(0);

  const flat: FlatItem[] = [
    ...result.pairs.map((data) => ({ kind: "pair" as const, data })),
    ...result.exchangers.map((data) => ({ kind: "exchanger" as const, data })),
    ...result.currencies.map((data) => ({ kind: "currency" as const, data })),
  ];

  const runSearch = useCallback(async (q: string) => {
    const id = ++reqId.current;
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResult({ exchangers: [], currencies: [], pairs: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
        { next: { revalidate: 60 } },
      );
      if (!res.ok || id !== reqId.current) return;
      const data = (await res.json()) as SearchResult;
      setResult(data);
      setActive(0);
    } catch {
      if (id === reqId.current) {
        setResult({ exchangers: [], currencies: [], pairs: [] });
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void runSearch(query), 180);
    return () => window.clearTimeout(t);
  }, [query, runSearch]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(item: FlatItem) {
    setOpen(false);
    setQuery("");
    if (item.kind === "exchanger") {
      router.push(`/exchangers/${item.data.slug}`);
      return;
    }
    if (item.kind === "pair") {
      const params = new URLSearchParams({
        from: item.data.from,
        to: item.data.to,
        mode: item.data.mode,
      });
      router.push(`/?${params.toString()}`);
      return;
    }
    // currency: open as "from", pick a sensible "to"
    const from = item.data.code;
    const to = item.data.cash ? "USDTTRC20" : "SBERRUB";
    const mode = item.data.cash || from.startsWith("CASH") ? "cash" : "online";
    const params = new URLSearchParams({ from, to, mode });
    router.push(`/?${params.toString()}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter") && query.trim()) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (item) go(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
          ⌕
        </span>
        <input
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder="Поиск пары, обменника, кода…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-2xl border border-line bg-input py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-2 max-h-[70vh] w-full min-w-[280px] overflow-auto rounded-2xl border border-line bg-bg-elevated py-2 shadow-[var(--card-shadow)]"
        >
          {loading && flat.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">Ищем…</p>
          ) : flat.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">Ничего не найдено</p>
          ) : (
            <>
              {result.pairs.length > 0 && (
                <Section title="Пары">
                  {result.pairs.map((pair, i) => {
                    const index = flat.findIndex(
                      (f) =>
                        f.kind === "pair" &&
                        f.data.from === pair.from &&
                        f.data.to === pair.to,
                    );
                    return (
                      <Row
                        key={`p-${pair.from}-${pair.to}`}
                        active={active === index}
                        onPick={() => go({ kind: "pair", data: pair })}
                        primary={pair.label}
                        secondary={pair.mode === "cash" ? "Наличные" : "Онлайн"}
                      />
                    );
                  })}
                </Section>
              )}
              {result.exchangers.length > 0 && (
                <Section title="Обменники">
                  {result.exchangers.map((ex) => {
                    const index = flat.findIndex(
                      (f) => f.kind === "exchanger" && f.data.id === ex.id,
                    );
                    return (
                      <Row
                        key={ex.id}
                        active={active === index}
                        onPick={() => go({ kind: "exchanger", data: ex })}
                        primary={ex.name}
                        secondary={`★ ${ex.rating.toFixed(1)} · ${ex.slug}`}
                      />
                    );
                  })}
                </Section>
              )}
              {result.currencies.length > 0 && (
                <Section title="Валюты / коды">
                  {result.currencies.map((c) => {
                    const index = flat.findIndex(
                      (f) => f.kind === "currency" && f.data.code === c.code,
                    );
                    return (
                      <Row
                        key={c.code}
                        active={active === index}
                        onPick={() => go({ kind: "currency", data: c })}
                        primary={c.code}
                        secondary={c.name}
                      />
                    );
                  })}
                </Section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  primary,
  secondary,
  active,
  onPick,
}: {
  primary: string;
  secondary: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={`flex w-full flex-col px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-accent-soft text-accent-deep"
          : "text-ink hover:bg-accent-soft/60"
      }`}
    >
      <span className="font-medium">{primary}</span>
      <span className="text-xs text-ink-muted">{secondary}</span>
    </button>
  );
}
