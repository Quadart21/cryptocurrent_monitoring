"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE_NAV, isNavActive } from "@/components/shell/nav";
import { NavIcon } from "@/components/shell/NavIcon";

const SPREAD_PX = 14;

export function IconSpreadNav() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  const hoveredIndex = hovered
    ? SITE_NAV.findIndex((item) => item.href === hovered)
    : -1;

  return (
    <nav
      className="ml-2 hidden min-w-0 items-center lg:flex"
      aria-label="Основное меню"
      onMouseLeave={() => setHovered(null)}
    >
      <ul className="flex items-center gap-0.5">
        {SITE_NAV.map((item, index) => {
          const active = isNavActive(pathname, item.href);
          const isOpen = hovered === item.href;
          let shift = 0;
          if (hoveredIndex >= 0 && !isOpen) {
            shift =
              index < hoveredIndex
                ? -SPREAD_PX * (hoveredIndex - index)
                : SPREAD_PX * (index - hoveredIndex);
          }

          return (
            <li
              key={item.href}
              className="relative"
              style={{
                transform: `translateX(${shift}px)`,
                transition:
                  "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                zIndex: isOpen ? 2 : 1,
              }}
            >
              <Link
                href={item.href}
                title={item.hint}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => setHovered(item.href)}
                onFocus={() => setHovered(item.href)}
                onBlur={() => setHovered(null)}
                className={`group flex h-10 items-center overflow-hidden rounded-2xl transition-[background-color,color,box-shadow,padding] duration-300 ${
                  isOpen ? "gap-2 px-3" : "gap-0 px-2.5"
                } ${
                  active || isOpen
                    ? "bg-accent text-white shadow-[var(--glow)]"
                    : "text-ink-muted hover:bg-accent-soft hover:text-ink"
                }`}
              >
                <NavIcon
                  name={item.icon}
                  className="size-[1.15rem] shrink-0"
                />
                <span
                  className={`overflow-hidden whitespace-nowrap font-display text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isOpen
                      ? "max-w-[7rem] translate-x-0 opacity-100"
                      : "max-w-0 -translate-x-1 opacity-0"
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
