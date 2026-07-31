import Link from "next/link";
import {
  AD_PERIOD_LABELS,
  AD_PLACEMENT_HINTS,
  AD_PLACEMENT_LABELS,
  AD_TYPE_LABELS,
  BANNER_SPECS,
  exampleBannerForPlacement,
  formatAdPrice,
} from "@/lib/ads";
import type { AdTariff } from "@/lib/store-types";

export function AdvertiseTariffs({ tariffs }: { tariffs: AdTariff[] }) {
  return (
    <section
      id="tariffs"
      className="scroll-mt-24 space-y-5"
      aria-labelledby="advertise-tariffs-heading"
    >
      <div>
        <h2
          id="advertise-tariffs-heading"
          className="font-display text-2xl font-semibold text-ink"
        >
          Форматы и цены
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Размеры и слоты совпадают с реальным размещением на сайте.
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
            const example = exampleBannerForPlacement(t.placement);
            return (
              <article
                key={t.id}
                className="flex flex-col rounded-2xl border border-line bg-bg-elevated/50 p-5 sm:p-6"
              >
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
                      {t.sizeLabel || spec?.sizeLabel || "по согласованию"}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-xs text-ink-muted">
                  {AD_PLACEMENT_HINTS[t.placement]}
                </p>

                {example && spec ? (
                  <div
                    className={`mt-4 overflow-hidden rounded-xl border border-line bg-bg-soft/40 ${spec.aspectClass} ${spec.maxHeightClass} w-full`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={example.src}
                      alt={example.alt}
                      width={example.width}
                      height={example.height}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : spec ? (
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
    </section>
  );
}

export function AdvertiseCta({
  note,
  href,
}: {
  note: string;
  href: string | null;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-accent/25 bg-accent-soft/30 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Готовы разместить?
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Пришлите макет по нужному размеру и желаемые даты — ответим со слотом.
        </p>
        {note ? (
          <p className="mt-3 text-sm text-ink-muted">{note}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="btn-primary inline-flex w-full shrink-0 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold sm:w-auto"
        >
          Написать
        </Link>
      ) : null}
    </section>
  );
}
