"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "@/components/BrandMark";
import { isNavActive, publicSiteNav } from "@/components/shell/nav";
import { NavIcon } from "@/components/shell/NavIcon";

export function MobileNav({
  brandLogoUrl,
  apiEnabled = true,
}: {
  brandLogoUrl?: string | null;
  apiEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const items = publicSiteNav(apiEnabled);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[200] lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
            />
            <div
              id="mobile-site-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Навигация"
              className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col border-r border-line bg-sidebar pt-[env(safe-area-inset-top)] shadow-[var(--card-shadow)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <BrandMark size={36} className="size-9" src={brandLogoUrl} />
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-ink">
                      GapSnap
                    </p>
                    <p className="text-xs text-ink-muted">Разделы сайта</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-bg-soft hover:text-ink"
                >
                  Закрыть
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                        active
                          ? "bg-accent text-white"
                          : "text-ink hover:bg-bg-soft"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-bg-elevated text-ink sm:min-h-10 sm:w-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
        aria-expanded={open}
        aria-controls="mobile-site-nav"
        aria-label="Открыть меню"
      >
        <span className="flex flex-col gap-1" aria-hidden>
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
        </span>
        <span className="hidden sm:inline">Меню</span>
      </button>
      {drawer}
    </div>
  );
}
