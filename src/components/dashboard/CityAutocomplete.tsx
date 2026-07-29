"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type CityOption = { code: string; name: string };

type Props = {
  cities: CityOption[];
  value: string;
  onChange: (code: string) => void;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export function CityAutocomplete({ cities, value, onChange }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = cities.find((c) => c.code === value) ?? cities[0];
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const next = cities.find((c) => c.code === value);
    if (next) setQuery(next.name);
  }, [value, cities]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        const current = cities.find((c) => c.code === value);
        if (current) setQuery(current.name);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [cities, value]);

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (!q) return cities.slice(0, 12);
    return cities
      .filter((c) => normalize(c.name).startsWith(q))
      .slice(0, 12);
  }, [cities, query]);

  function pick(city: CityOption) {
    setQuery(city.name);
    setOpen(false);
    onChange(city.code);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = suggestions[activeIndex];
      if (item) pick(item);
    } else if (event.key === "Escape") {
      setOpen(false);
      const current = cities.find((c) => c.code === value);
      if (current) setQuery(current.name);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Начните вводить город…"
        value={query}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        className="min-h-12 w-full rounded-2xl border border-line bg-input px-3 py-3 text-base font-medium text-ink outline-none focus:border-accent sm:text-sm"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-line bg-bg-elevated py-1 shadow-[var(--card-shadow)]"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-muted">
              Ничего не найдено
            </li>
          ) : (
            suggestions.map((city, index) => (
              <li key={city.code} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(city)}
                  className={`flex w-full px-3 py-2.5 text-left text-sm transition ${
                    index === activeIndex
                      ? "bg-accent-soft text-accent-deep"
                      : "text-ink hover:bg-accent-soft/60"
                  }`}
                >
                  {city.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
