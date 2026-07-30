"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  adminNavBadgeCount,
} from "@/components/admin/nav";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ADMIN_PATH } from "@/lib/admin-auth";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { counts, lastGlobalSyncAt, logout, refresh, busy } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pendingTotal =
    (counts?.pending ?? 0) +
    (counts?.pendingReviews ?? 0) +
    (counts?.pendingComplaints ?? 0) +
    (counts?.pendingCatalog ?? 0) +
    (counts?.bannerMissing ?? 0);

  const grouped = useMemo(
    () =>
      ADMIN_NAV_GROUPS.map((group) => ({
        ...group,
        items: ADMIN_NAV.filter((item) => item.group === group.id),
      })).filter((g) => g.items.length > 0),
    [],
  );

  const current = useMemo(() => {
    return (
      ADMIN_NAV.find((item) =>
        item.href === ADMIN_PATH
          ? pathname === ADMIN_PATH
          : pathname.startsWith(item.href),
      ) ?? null
    );
  }, [pathname]);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="relative z-10 min-h-screen bg-bg text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside
          className={`fixed inset-y-0 left-0 z-[60] flex w-[min(100%,17.5rem)] flex-col border-r border-line bg-sidebar transition-transform lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="border-b border-line px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              GapSnap
            </p>
            <Link
              href={ADMIN_PATH}
              className="mt-0.5 block font-display text-xl font-semibold text-ink"
              onClick={closeMobile}
            >
              Админка
            </Link>
            <p className="mt-1 truncate text-[11px] text-ink-muted">
              Синк:{" "}
              {lastGlobalSyncAt
                ? new Date(lastGlobalSyncAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "ещё не было"}
            </p>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {grouped.map((group) => (
              <div key={group.id}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.href === ADMIN_PATH
                        ? pathname === ADMIN_PATH
                        : pathname.startsWith(item.href);
                    const badge = adminNavBadgeCount(item.badge, counts);
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={closeMobile}
                          title={item.description}
                          className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm transition ${
                            active
                              ? "bg-accent-soft font-semibold text-ink"
                              : "text-ink-muted hover:bg-bg-soft hover:text-ink"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {badge > 0 ? (
                            <span className="shrink-0 rounded-md bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-warn">
                              {badge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="space-y-1.5 border-t border-line p-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="w-full rounded-xl border border-line px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-bg-soft hover:text-ink disabled:opacity-60"
            >
              Обновить данные
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full rounded-xl border border-line px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-danger/10 hover:text-danger"
            >
              Выйти
            </button>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Закрыть меню"
            className="fixed inset-0 z-[50] bg-black/40 lg:hidden"
            onClick={closeMobile}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg-elevated/95 px-3 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-line px-3 py-2 text-sm lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                Меню
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {current?.label ?? "Панель управления"}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {current?.description ??
                    (pendingTotal > 0
                      ? `Ждут решения: ${pendingTotal}`
                      : "Очередь пуста")}
                  {pendingTotal > 0 && current
                    ? ` · очередь ${pendingTotal}`
                    : ""}
                </p>
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
