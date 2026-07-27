"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SITE_NAV, isNavActive } from "@/components/shell/nav";
import { NavIcon } from "@/components/shell/NavIcon";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-line bg-bg-elevated px-3 py-2 text-sm font-semibold text-ink"
        aria-expanded={open}
        aria-controls="mobile-site-nav"
      >
        <span className="flex flex-col gap-1" aria-hidden>
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
        </span>
        Меню
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-site-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Навигация"
            className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col border-r border-line bg-sidebar shadow-[var(--card-shadow)]"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <div>
                <p className="font-display text-lg font-semibold text-ink">
                  Cryptomon
                </p>
                <p className="text-xs text-ink-muted">Разделы сайта</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-bg-soft hover:text-ink"
              >
                Закрыть
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {SITE_NAV.map((item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                      active
                        ? "bg-accent text-white shadow-[var(--glow)]"
                        : "text-ink hover:bg-accent-soft"
                    }`}
                  >
                    <NavIcon
                      name={item.icon}
                      className={`size-5 shrink-0 ${active ? "text-white" : "text-accent"}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          active ? "text-white/80" : "text-ink-muted"
                        }`}
                      >
                        {item.hint}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
