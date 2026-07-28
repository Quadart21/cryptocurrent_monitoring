"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ADMIN_NAV } from "@/components/admin/nav";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ADMIN_PATH } from "@/lib/admin-auth";

function badgeFor(id: string, counts: ReturnType<typeof useAdmin>["counts"]) {
  if (!counts) return 0;
  if (id === "exchangers") return counts.pending;
  if (id === "reviews") return counts.pendingReviews;
  if (id === "sync") return counts.pendingCatalog + (counts.bannerMissing ?? 0);
  return 0;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { counts, lastGlobalSyncAt, logout, refresh, busy } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pendingTotal =
    (counts?.pending ?? 0) +
    (counts?.pendingReviews ?? 0) +
    (counts?.pendingCatalog ?? 0) +
    (counts?.bannerMissing ?? 0);

  return (
    <div className="relative z-10 min-h-screen bg-bg text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside
          className={`fixed inset-y-0 left-0 z-[60] w-[min(100%,18rem)] border-r border-line bg-sidebar p-4 transition-transform lg:static lg:z-auto lg:w-72 lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-6 px-2">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              GapSnap
            </p>
            <Link
              href={ADMIN_PATH}
              className="font-display text-2xl font-semibold text-ink"
              onClick={() => setMobileOpen(false)}
            >
              Админка
            </Link>
            <p className="mt-1 text-xs text-ink-muted">
              Синхронизация:{" "}
              {lastGlobalSyncAt
                ? new Date(lastGlobalSyncAt).toLocaleString("ru-RU")
                : "ещё не было"}
            </p>
          </div>

          <nav className="space-y-1">
            {ADMIN_NAV.map((item) => {
              const active =
                item.href === ADMIN_PATH
                  ? pathname === ADMIN_PATH
                  : pathname.startsWith(item.href);
              const badge = badgeFor(item.id, counts);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-start justify-between gap-2 rounded-2xl px-3 py-3 transition ${
                    active
                      ? "bg-accent-soft text-ink"
                      : "text-ink-muted hover:bg-bg-soft hover:text-ink"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs opacity-80">
                      {item.description}
                    </span>
                  </span>
                  {badge > 0 && (
                    <span className="rounded-full bg-warn/20 px-2 py-0.5 text-xs font-semibold text-warn">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 space-y-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="w-full rounded-2xl border border-line px-3 py-2.5 text-left text-sm text-ink-muted hover:text-ink disabled:opacity-60"
            >
              Обновить данные
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full rounded-2xl border border-line px-3 py-2.5 text-left text-sm text-ink-muted hover:text-danger"
            >
              Выйти
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <button
            type="button"
            aria-label="Закрыть меню"
            className="fixed inset-0 z-[50] bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-[var(--topbar)] px-3 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-line px-3 py-2 text-sm lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                Меню
              </button>
              <div>
                <p className="text-sm font-semibold text-ink">Панель управления</p>
                {pendingTotal > 0 ? (
                  <p className="text-xs text-warn">
                    Ждут решения: {pendingTotal}
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted">Очередь пуста</p>
                )}
              </div>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
