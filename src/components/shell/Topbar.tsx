"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { GlobalSearch } from "@/components/shell/GlobalSearch";

export function Topbar({
  title = "Мониторинг",
}: {
  title?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-[var(--topbar)] backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="min-w-0 shrink-0">
          <Link
            href="/"
            className="font-display text-lg font-semibold tracking-tight text-ink"
          >
            Cryptomon
          </Link>
          <p className="truncate text-xs text-ink-muted sm:text-sm">{title}</p>
        </div>

        <GlobalSearch className="mx-auto hidden min-w-0 max-w-md flex-1 md:block" />

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
      <div className="border-t border-line/50 px-4 py-2 md:hidden">
        <GlobalSearch />
      </div>
    </header>
  );
}
