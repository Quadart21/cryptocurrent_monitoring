"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TAB_NAV, isNavActive } from "@/components/shell/nav";
import { NavIcon } from "@/components/shell/NavIcon";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-bg-elevated/95 backdrop-blur-md md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <ul
        className="mx-auto grid max-w-[1400px] grid-cols-5"
        style={{ height: "var(--mobile-nav-h)" }}
      >
        {MOBILE_TAB_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 px-1 transition ${
                  active ? "text-accent" : "text-ink-muted"
                }`}
              >
                <NavIcon
                  name={item.icon}
                  className={`size-5 shrink-0 ${active ? "text-accent" : "text-ink-muted"}`}
                />
                <span
                  className={`max-w-full truncate text-[10px] font-semibold leading-tight ${
                    active ? "text-accent" : "text-ink-muted"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
