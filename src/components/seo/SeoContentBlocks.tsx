import type { SeoSection } from "@/lib/seo-landing-content";

export function SeoContentBlocks({
  sections,
  className = "",
}: {
  sections: SeoSection[];
  className?: string;
}) {
  if (!sections.length) return null;

  return (
    <div className={`space-y-10 ${className}`.trim()}>
      {sections.map((section) => (
        <section key={section.title} className="max-w-3xl space-y-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.65rem]">
            {section.title}
          </h2>
          <div className="space-y-3.5 text-[15px] leading-7 text-ink-muted sm:text-base sm:leading-8">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
