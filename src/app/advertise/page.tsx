import type { Metadata } from "next";
import Link from "next/link";
import {
  AD_PERIOD_LABELS,
  AD_PLACEMENT_HINTS,
  AD_PLACEMENT_LABELS,
  AD_TYPE_LABELS,
  BANNER_SPECS,
  formatAdPrice,
} from "@/lib/ads";
import { getAdPricing, listAdTariffs } from "@/lib/store";

export const metadata: Metadata = {
  title: "Рекламодателям",
  description:
    "Форматы и тарифы рекламы в мониторинге GapSnap: баннеры, бегущая строка, закреп в курсах.",
};

export const revalidate = 60;

function contactHref(contact: string) {
  const c = contact.trim();
  if (!c) return null;
  if (c.includes("@") && !c.startsWith("@")) return `mailto:${c}`;
  if (c.startsWith("@")) return `https://t.me/${c.slice(1)}`;
  if (c.startsWith("http")) return c;
  return `mailto:${c}`;
}

export default async function AdvertisePage() {
  const [tariffs, pricing] = await Promise.all([
    listAdTariffs({ activeOnly: true }),
    getAdPricing(),
  ]);
  const href = contactHref(pricing.contact);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-bg-elevated via-bg to-accent-soft/40 px-6 py-10 sm:px-10 sm:py-14">
        <p className="font-display text-sm font-semibold tracking-[0.2em] text-accent uppercase">
          GapSnap
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-ink sm:text-4xl">
          Реклама в мониторинге
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
          {pricing.intro}
        </p>
        {href ? (
          <Link
            href={href}
            className="btn-primary mt-6 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Связаться: {pricing.contact}
          </Link>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Форматы и цены
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Размеры баннеров и слоты соответствуют реальному размещению на сайте.
          </p>
        </div>

        {tariffs.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Тарифы скоро появятся. Напишите нам, чтобы обсудить размещение.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {tariffs.map((t) => {
              const spec = BANNER_SPECS[t.placement];
              return (
                <article key={t.id} className="card flex flex-col p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                        {AD_TYPE_LABELS[t.type]}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-semibold text-ink">
                        {t.title}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-semibold tabular-nums text-ink">
                        {formatAdPrice(t.price, t.currency)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        за {AD_PERIOD_LABELS[t.period]}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    {t.description}
                  </p>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-line bg-bg-soft/60 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                        Слот
                      </dt>
                      <dd className="mt-1 font-medium text-ink">
                        {AD_PLACEMENT_LABELS[t.placement]}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-line bg-bg-soft/60 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                        Размер
                      </dt>
                      <dd className="mt-1 font-medium tabular-nums text-ink">
                        {t.sizeLabel ||
                          spec?.sizeLabel ||
                          "по согласованию"}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-xs text-ink-muted">
                    {AD_PLACEMENT_HINTS[t.placement]}
                  </p>

                  {spec ? (
                    <div
                      className={`mt-4 overflow-hidden rounded-xl border border-dashed border-line bg-bg-soft/40 ${spec.aspectClass} ${spec.maxHeightClass} w-full`}
                      title={`Макет ${spec.sizeLabel}`}
                    >
                      <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                        макет {spec.sizeLabel}
                      </div>
                    </div>
                  ) : null}

                  {t.features.length > 0 ? (
                    <ul className="mt-4 space-y-1.5 text-sm text-ink">
                      {t.features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span className="text-accent" aria-hidden>
                            •
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {pricing.note ? (
          <p className="text-sm text-ink-muted">{pricing.note}</p>
        ) : null}
      </section>

      <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Готовы разместить?
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Пришлите макет по нужному размеру и желаемые даты — ответим с слотом.
          </p>
        </div>
        {href ? (
          <Link
            href={href}
            className="btn-primary inline-flex w-fit rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Написать
          </Link>
        ) : null}
      </section>
    </div>
  );
}
