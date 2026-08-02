import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import {
  contactHref,
  telegramDisplay,
  telegramHref,
} from "@/lib/site-contacts";

export function Footer({
  brandLogoUrl,
  apiEnabled = true,
  contactEmail,
  contactTelegram,
}: {
  brandLogoUrl?: string | null;
  apiEnabled?: boolean;
  contactEmail?: string | null;
  contactTelegram?: string | null;
}) {
  const year = new Date().getFullYear();

  const serviceLinks = [
    { href: "/exchangers", label: "Обменники" },
    { href: "/blog", label: "Новости" },
    { href: "/blacklist", label: "Чёрный список" },
  ];

  const partnerLinks = [
    { href: "/advertise", label: "Реклама" },
    ...(apiEnabled ? [{ href: "/api-docs", label: "API" }] : []),
    { href: "/partners", label: "Партнёрам" },
    { href: "/apply", label: "Добавить обменник" },
    { href: "/cabinet", label: "Кабинет" },
  ];

  const legalLinks = [
    { href: "/terms", label: "Условия" },
    { href: "/privacy", label: "Конфиденциальность" },
    { href: "/cookies", label: "Cookies" },
    { href: "/offer", label: "Оферта" },
  ];

  const email = (contactEmail ?? "").trim();
  const telegram = telegramDisplay(contactTelegram ?? "");
  const emailLink = email ? contactHref(email) : null;
  const telegramLink = telegramHref(contactTelegram ?? "");
  const hasContacts = Boolean(emailLink || telegramLink);

  return (
    <footer className="mt-auto border-t border-line bg-bg-elevated">
      <div className="mx-auto max-w-[1400px] px-3 pt-8 pb-6 sm:px-6 sm:pt-10 sm:pb-7 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] lg:gap-12">
          <div className="min-w-0 max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-ink transition hover:opacity-80"
            >
              <BrandMark size={32} className="size-8" src={brandLogoUrl} />
              <span className="font-display text-base font-semibold tracking-tight">
                GapSnap
              </span>
            </Link>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
              Независимый мониторинг обменников. Мы не проводим обмен и не
              храним средства.
            </p>
          </div>

          <div
            className={`grid grid-cols-2 gap-x-6 gap-y-7 ${
              hasContacts ? "sm:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            <FooterCol title="Сервис" links={serviceLinks} />
            <FooterCol title="Партнёрам" links={partnerLinks} />
            <FooterCol title="Документы" links={legalLinks} />
            {hasContacts ? (
              <div>
                <p className="text-[11px] font-medium tracking-wide text-ink-muted">
                  Контакты
                </p>
                <ul className="mt-2.5 space-y-1.5 text-[13px]">
                  {emailLink ? (
                    <li>
                      <a
                        href={emailLink}
                        className="break-all text-ink-muted transition hover:text-ink"
                      >
                        {email}
                      </a>
                    </li>
                  ) : null}
                  {telegramLink ? (
                    <li>
                      <a
                        href={telegramLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-muted transition hover:text-ink"
                      >
                        {telegram}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line/80 pt-5 text-[12px] text-ink-muted sm:mt-9 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p>
            © {year} GapSnap · 18+
          </p>
          <p className="sm:text-right">
            Курсы и оферты обменников носят информационный характер.
          </p>
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
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide text-ink-muted">
        {title}
      </p>
      <ul className="mt-2.5 space-y-1.5 text-[13px]">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-ink-muted transition hover:text-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
