"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Обмен", icon: "▣" },
  { href: "/exchangers", label: "Обменники", icon: "◎" },
  { href: "/catalogs", label: "Справочники", icon: "☰" },
  { href: "/advertise", label: "Реклама", icon: "◈" },
  { href: "/apply", label: "Добавить", icon: "+" },
  { href: "/cabinet", label: "Кабинет", icon: "◇" },
  { href: "/blacklist", label: "Чёрный список", icon: "!" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[72px] flex-col items-center border-r border-line bg-sidebar/95 py-5 backdrop-blur-xl">
      <Link
        href="/"
        className="mb-8 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-sm font-bold text-white shadow-[var(--glow)]"
        aria-label="Cryptomon"
      >
        C
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex size-11 items-center justify-center rounded-2xl text-lg transition ${
                active
                  ? "bg-accent text-white shadow-[var(--glow)]"
                  : "text-ink-muted hover:bg-accent-soft hover:text-accent"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto text-[10px] tracking-[0.2em] text-ink-muted">
        CM
      </div>
    </aside>
  );
}
