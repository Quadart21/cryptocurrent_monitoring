"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { logoPublicUrl } from "@/lib/logo-url";
import type { OwnerExchanger } from "@/components/owner/OwnerProvider";
import {
  OWNER_SUPPORT_TG,
  OWNER_SUPPORT_TG_URL,
  OWNER_TABS,
  type OwnerTabId,
  statusLabel,
  statusTone,
} from "@/components/owner/owner-utils";
import { OwnerBadge } from "@/components/owner/OwnerUi";

export function OwnerShell({
  exchanger,
  tab,
  onTab,
  onLogout,
  busy,
  children,
}: {
  exchanger: OwnerExchanger;
  tab: OwnerTabId;
  onTab: (id: OwnerTabId) => void;
  onLogout: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const logoSrc = logoPublicUrl(exchanger.id, exchanger.logo);

  return (
    <div className="relative z-10 min-h-screen bg-bg pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-bg-elevated/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="size-11 shrink-0 rounded-2xl border border-line bg-bg-soft object-contain p-1"
              />
            ) : (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 font-display text-base font-bold text-accent">
                {exchanger.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Кабинет владельца
                </p>
                <OwnerBadge tone={statusTone(exchanger.status)}>
                  {statusLabel(exchanger.status)}
                </OwnerBadge>
              </div>
              <h1 className="truncate font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
                {exchanger.name}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link
              href={`/exchangers/${exchanger.slug}`}
              className="hidden min-h-10 items-center rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent/40 hover:text-accent sm:inline-flex"
            >
              На сайте
            </Link>
            <a
              href={OWNER_SUPPORT_TG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden min-h-10 items-center rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent/40 hover:text-accent md:inline-flex"
              title="Поддержка в Telegram"
            >
              @{OWNER_SUPPORT_TG}
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={onLogout}
              className="min-h-10 rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-danger/40 hover:text-danger"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Desktop / tablet tabs */}
        <nav
          aria-label="Разделы кабинета"
          className="mx-auto hidden max-w-5xl gap-1 overflow-x-auto px-3 pb-3 sm:px-6 md:flex"
        >
          {OWNER_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-accent text-white shadow-sm"
                    : "text-ink-muted hover:bg-bg-soft hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
        {children}
      </main>

      {/* Mobile bottom nav — same tabs as desktop */}
      <nav
        aria-label="Разделы кабинета"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5 gap-0.5 px-1 py-1.5">
          {OWNER_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 text-[11px] font-semibold transition ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-ink-muted"
                }`}
              >
                <span
                  className={`mb-0.5 size-1.5 rounded-full ${
                    active ? "bg-accent" : "bg-transparent"
                  }`}
                  aria-hidden
                />
                {item.short}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
