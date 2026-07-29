"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { IconSpreadNav } from "@/components/shell/IconSpreadNav";
import { MobileNav } from "@/components/shell/MobileNav";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-[var(--topbar)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-col">
        <div className="grid h-14 min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:h-16 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 justify-self-start">
            <MobileNav />
            <Link
              href="/"
              className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-sm font-bold text-white shadow-[var(--glow)] sm:size-9">
                G
              </span>
              <span className="truncate font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
                GapSnap
              </span>
            </Link>
          </div>

          <div className="hidden min-w-0 justify-self-center px-1 lg:block">
            <IconSpreadNav />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end sm:gap-3">
            <GlobalSearch className="hidden min-w-0 max-w-[14rem] flex-1 md:block xl:max-w-xs" />
            <ThemeToggle />
          </div>
        </div>

        <div className="border-t border-line/50 px-3 py-2 sm:px-6 md:hidden">
          <GlobalSearch />
        </div>
      </div>
    </header>
  );
}
