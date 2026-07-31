import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function Footer({ brandLogoUrl }: { brandLogoUrl?: string | null }) {
  return (
    <footer className="mt-auto border-t border-line bg-bg-elevated">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-3 py-8 sm:px-6 sm:py-10 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div className="min-w-0 max-w-md">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} className="size-9" src={brandLogoUrl} />
            <p className="font-display text-lg font-semibold text-ink">GapSnap</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Независимый мониторинг обменных пунктов. Мы не проводим обмен и не
            храним средства — помогаем выбрать сервис по курсу и репутации.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <FooterCol
            title="Сервис"
            links={[
              { href: "/exchangers", label: "Обменники" },
              { href: "/blog", label: "Новости" },
              { href: "/blacklist", label: "Чёрный список" },
            ]}
          />
          <FooterCol
            title="Партнёрам"
            links={[
              { href: "/advertise", label: "Реклама" },
              { href: "/partners", label: "Партнёрам" },
              { href: "/apply", label: "Добавить обменник" },
              { href: "/cabinet", label: "Кабинет" },
            ]}
          />
          <FooterCol
            title="Документы"
            links={[
              { href: "/privacy", label: "Конфиденциальность" },
              { href: "/cookies", label: "Cookies" },
              { href: "/offer", label: "Оферта" },
            ]}
          />
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      <ul className="mt-3 space-y-1 text-sm text-ink-muted">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-10 items-center transition hover:text-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
