"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Topbar({
  title = "Мониторинг",
}: {
  title?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-[var(--topbar)] backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
        <div className="min-w-0">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
            Cryptomon
          </Link>
          <p className="truncate text-xs text-ink-muted sm:text-sm">{title}</p>
        </div>

        <div className="mx-auto hidden max-w-md flex-1 md:block">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
              ⌕
            </span>
            <input
              type="search"
              placeholder="Поиск пары, обменника, кода…"
              className="w-full rounded-2xl border border-line bg-input py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            href="/apply"
            className="btn-primary hidden rounded-2xl px-4 py-2.5 text-sm font-semibold sm:inline-flex"
          >
            Добавить обменник
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
