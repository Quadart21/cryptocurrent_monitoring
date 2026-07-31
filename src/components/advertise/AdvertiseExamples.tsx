import {
  AD_EXAMPLE_GALLERY,
  AD_PLACEMENT_LABELS,
} from "@/lib/ads";

export function AdvertiseExamples() {
  return (
    <section className="space-y-5" aria-labelledby="advertise-examples-heading">
      <div>
        <h2
          id="advertise-examples-heading"
          className="font-display text-2xl font-semibold text-ink"
        >
          Примеры креативов
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Реальные размеры слотов. Макет можно прислать в JPG, PNG, WebP или SVG.
        </p>
      </div>

      <ul className="space-y-5">
        {AD_EXAMPLE_GALLERY.map((item) => (
          <li key={item.key} className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-display text-base font-semibold text-ink">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {item.placements.map((p) => AD_PLACEMENT_LABELS[p]).join(" · ")}
                </p>
              </div>
              <p className="rounded-lg border border-line bg-bg-soft/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink">
                {item.sizeLabel} px
              </p>
            </div>
            <div
              className={`overflow-hidden rounded-xl border border-line bg-bg-soft/40 shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_12%,transparent)] ${item.aspectClass} ${item.maxHeightClass} w-full`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={`Пример рекламного баннера GapSnap ${item.sizeLabel}`}
                width={item.width}
                height={item.height}
                className="h-full w-full object-cover object-center"
                loading="lazy"
                decoding="async"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
