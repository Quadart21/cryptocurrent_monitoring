import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { listBlogPosts, type BlogPost } from "@/lib/store";

export const metadata: Metadata = {
  title: "Новости",
  description:
    "Свежие новости крипторынка простым языком: курсы, обменники, безопасность и то, что важно при обмене.",
};
export const dynamic = "force-dynamic";

function formatRuDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function excerptOf(post: BlogPost): string {
  const raw = (post.excerpt || post.body || "").replace(/\s+/g, " ").trim();
  if (raw.length <= 180) return raw;
  return `${raw.slice(0, 177).trimEnd()}…`;
}

function Cover({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={className ?? "h-full w-full object-cover"}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--accent)]/25 via-bg-elevated to-[var(--accent-2)]/20 ${className ?? ""}`}
      aria-hidden
    >
      <span className="font-display text-4xl font-semibold text-accent-deep/50">
        {title.trim().charAt(0).toUpperCase() || "N"}
      </span>
    </div>
  );
}

export default async function BlogIndexPage() {
  const posts = await listBlogPosts({ status: "published" });
  const [featured, ...rest] = posts;

  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Главная" }, { label: "Новости" }]}
      />

      <section className="animate-rise relative overflow-hidden rounded-[1.75rem] border border-line bg-bg-elevated px-5 py-8 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] opacity-20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-[var(--accent-2)]/20 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            GapSnap · лента
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Новости
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-muted sm:text-lg">
            Коротко и по делу о крипторынке: что происходит с курсами, обменниками
            и безопасностью — чтобы проще выбирать, куда менять.
          </p>
        </div>
      </section>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-14 text-center text-sm text-ink-muted">
          Пока новостей нет — скоро появятся свежие материалы.
        </p>
      ) : (
        <div className="space-y-8">
          {featured ? (
            <Link
              href={`/blog/${featured.slug}`}
              className="animate-rise-delay-1 group grid overflow-hidden rounded-[1.75rem] border border-line bg-bg-elevated shadow-[var(--card-shadow)] transition hover:border-accent/40 lg:grid-cols-[1.15fr_0.85fr]"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-bg-soft lg:aspect-auto lg:min-h-[320px]">
                <Cover
                  src={featured.coverImageUrl}
                  title={featured.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent-deep">
                    Главное
                  </span>
                  {featured.publishedAt ? (
                    <time dateTime={featured.publishedAt}>
                      {formatRuDate(featured.publishedAt)}
                    </time>
                  ) : null}
                </div>
                <h2 className="font-display text-2xl font-semibold leading-snug text-ink sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="text-sm leading-relaxed text-ink-muted sm:text-base">
                  {excerptOf(featured)}
                </p>
                <span className="text-sm font-semibold text-accent-deep transition group-hover:underline">
                  Читать новость →
                </span>
              </div>
            </Link>
          ) : null}

          {rest.length > 0 ? (
            <div className="animate-rise-delay-2 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((p) => (
                <Link
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-line bg-bg-elevated shadow-[var(--card-shadow)] transition hover:border-accent/40 hover:shadow-[var(--glow)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-bg-soft">
                    <Cover
                      src={p.coverImageUrl}
                      title={p.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-5">
                    {p.publishedAt ? (
                      <time
                        dateTime={p.publishedAt}
                        className="text-xs text-ink-muted"
                      >
                        {formatRuDate(p.publishedAt)}
                      </time>
                    ) : null}
                    <h2 className="font-display text-lg font-semibold leading-snug text-ink">
                      {p.title}
                    </h2>
                    <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-ink-muted">
                      {excerptOf(p)}
                    </p>
                    <span className="pt-1 text-sm font-semibold text-accent-deep">
                      Читать →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
