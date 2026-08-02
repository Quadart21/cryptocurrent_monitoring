"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type CurrencyOption = {
  code: string;
  name: string;
  groupId?: number;
  groupName?: string;
};

type Props = {
  label: string;
  value: string;
  exclude?: string;
  options: CurrencyOption[];
  onChange: (code: string) => void;
  placeholder?: string;
};

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е");
}

function rankMatch(option: CurrencyOption, q: string): number {
  if (!q) return 50;
  const code = normalize(option.code);
  const name = normalize(option.name);
  if (code === q) return 0;
  if (code.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  const words = name.split(/[^a-z0-9а-я]+/i).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 3;
  if (name.includes(q)) return 4;
  if (code.includes(q)) return 5;
  return -1;
}

export function CurrencyAutocomplete({
  label,
  value,
  exclude,
  options,
  onChange,
  placeholder = "Начните вводить валюту…",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => options.filter((c) => c.code !== exclude),
    [options, exclude],
  );
  const selected =
    filtered.find((c) => c.code === value) ?? filtered[0] ?? null;

  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const next = filtered.find((c) => c.code === value) ?? filtered[0];
    if (next) setQuery(next.name);
  }, [value, filtered]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        const current = filtered.find((c) => c.code === value) ?? filtered[0];
        if (current) setQuery(current.name);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [filtered, value]);

  const suggestions = useMemo(() => {
    const selectedName = selected?.name ?? "";
    const browsing =
      !query.trim() || normalize(query) === normalize(selectedName);
    const q = browsing ? "" : normalize(query);
    const scored = filtered
      .map((c) => ({ c, rank: rankMatch(c, q) }))
      .filter((x) => x.rank >= 0);
    scored.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.c.name.localeCompare(b.c.name, "ru");
    });
    return scored.slice(0, 12).map((x) => x.c);
  }, [filtered, query, selected]);

  function pick(option: CurrencyOption) {
    setQuery(option.name);
    setOpen(false);
    onChange(option.code);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) =>
        Math.min(i + 1, Math.max(suggestions.length - 1, 0)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = suggestions[activeIndex];
      if (item) pick(item);
    } else if (event.key === "Escape") {
      setOpen(false);
      const current = filtered.find((c) => c.code === value) ?? filtered[0];
      if (current) setQuery(current.name);
    }
  }

  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      <div ref={rootRef} className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
            // Select all so typing replaces immediately
            requestAnimationFrame(() => {
              const el = rootRef.current?.querySelector("input");
              el?.select();
            });
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className="min-h-11 w-full rounded-xl border border-line bg-input px-3 py-2.5 text-base font-medium text-ink outline-none focus:border-accent sm:text-sm"
        />

        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-line bg-bg-elevated py-1 shadow-[var(--card-shadow)]"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-ink-muted">
                Ничего не найдено
              </li>
            ) : (
              suggestions.map((option, index) => (
                <li
                  key={option.code}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                      index === activeIndex
                        ? "bg-accent-soft text-accent-deep"
                        : "text-ink hover:bg-accent-soft/60"
                    }`}
                  >
                    <span className="min-w-0 truncate">{option.name}</span>
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      {option.code}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </label>
  );
}
