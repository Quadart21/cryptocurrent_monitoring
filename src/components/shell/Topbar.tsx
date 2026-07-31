"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { IconSpreadNav } from "@/components/shell/IconSpreadNav";
import { MobileNav } from "@/components/shell/MobileNav";

export function Topbar({ brandLogoUrl }: { brandLogoUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg-elevated/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-col">
        <div className="grid h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:h-16 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 justify-self-start">
            <MobileNav brandLogoUrl={brandLogoUrl} />
            <Link
              href="/"
              className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5"
            >
              <BrandMark
                size={36}
                className="size-8 sm:size-9"
                priority
                src={brandLogoUrl}
              />
              <span className="truncate font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
                GapSnap
              </span>
            </Link>
          </div>

          <div className="hidden min-w-0 justify-self-center px-1 lg:block">
            <IconSpreadNav />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5 justify-self-end sm:gap-3">
            <GlobalSearch className="hidden min-w-0 max-w-[14rem] flex-1 md:block xl:max-w-xs" />
            <ThemeToggle />
          </div>
        </div>

        <div className="border-t border-line px-3 py-2 sm:px-6 md:hidden">
          <GlobalSearch />
        </div>
      </div>
    </header>
  );
}
