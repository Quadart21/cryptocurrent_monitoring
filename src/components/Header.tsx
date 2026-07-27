import Link from "next/link";

const links = [
  { href: "/", label: "Обмен" },
  { href: "/exchangers", label: "Обменники" },
  { href: "/apply", label: "Добавить" },
  { href: "/blacklist", label: "Чёрный список" },
];

export function Header() {
  return (
    <header className="border-b border-line/70 bg-bg-elevated/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
            Cryptomon
          </span>
          <span className="hidden text-xs text-ink-muted sm:inline">
            мониторинг
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-deep sm:px-3"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
