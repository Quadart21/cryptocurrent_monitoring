"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { MobileNav } from "@/components/shell/MobileNav";
import { SITE_NAV, isNavActive } from "@/components/shell/nav";

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-[var(--topbar)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-col">
        <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
          <MobileNav />

          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-sm font-bold text-white shadow-[var(--glow)]">
              C
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              Cryptomon
            </span>
          </Link>

          <nav
            className="ml-2 hidden min-w-0 items-center gap-0.5 lg:flex"
            aria-label="Основное меню"
          >
            {SITE_NAV.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.hint}
                  className={`rounded-xl px-2.5 py-1.5 text-sm font-semibold transition xl:px-3 ${
                    active
                      ? "bg-accent text-white shadow-[var(--glow)]"
                      : "text-ink-muted hover:bg-accent-soft hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <GlobalSearch className="hidden min-w-0 max-w-xs flex-1 md:block lg:max-w-sm" />
            <ThemeToggle />
          </div>
        </div>

        <div className="border-t border-line/50 px-4 py-2 md:hidden">
          <GlobalSearch />
        </div>
      </div>
    </header>
  );
}
