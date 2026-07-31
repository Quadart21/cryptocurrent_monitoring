import Link from "next/link";

export function advertiseContactHref(contact: string): string | null {
  const c = contact.trim();
  if (!c) return null;
  if (c.includes("@") && !c.startsWith("@")) return `mailto:${c}`;
  if (c.startsWith("@")) return `https://t.me/${c.slice(1)}`;
  if (c.startsWith("http")) return c;
  return `mailto:${c}`;
}

export function AdvertiseHero({
  intro,
  contact,
  href,
}: {
  intro: string;
  contact: string;
  href: string | null;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-line sm:rounded-[2rem]">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent_55%),radial-gradient(ellipse_at_90%_80%,color-mix(in_oklab,var(--accent-2)_18%,transparent),transparent_50%),linear-gradient(160deg,var(--bg-elevated),var(--bg))]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,var(--ink)_1px,transparent_1px),linear-gradient(to_bottom,var(--ink)_1px,transparent_1px)] [background-size:28px_28px]"
      />

      <div className="relative px-4 py-10 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
        <p className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
          <span className="text-ink">Gap</span>
          <span className="text-accent">Snap</span>
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-xl font-semibold text-ink sm:mt-5 sm:text-3xl">
          Реклама в мониторинге
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted sm:mt-4 sm:text-base">
          {intro}
        </p>
        {href ? (
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Link
              href={href}
              className="btn-primary inline-flex min-h-11 items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold"
            >
              Связаться: {contact}
            </Link>
            <a
              href="#tariffs"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line bg-bg-elevated/70 px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent/40"
            >
              Смотреть тарифы
            </a>
          </div>
        ) : (
          <a
            href="#tariffs"
            className="btn-primary mt-7 inline-flex min-h-11 items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold sm:mt-8"
          >
            Смотреть тарифы
          </a>
        )}
      </div>
    </section>
  );
}
