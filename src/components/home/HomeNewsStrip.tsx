import Link from "next/link";
import type { BlogPost } from "@/lib/store";

function formatRuDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function Cover({ src, title }: { src: string; title: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
      />
    );
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--accent)]/25 via-bg-elevated to-[var(--accent-2)]/20"
      aria-hidden
    >
      <span className="font-display text-2xl font-semibold text-accent-deep/45">
        {title.trim().charAt(0).toUpperCase() || "N"}
      </span>
    </div>
  );
}

export function HomeNewsStrip({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null;

  return (
    <section className="animate-rise-delay-2 space-y-4 border-t border-line/70 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
            Лента
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
            Новости рынка
          </h2>
        </div>
        <Link
          href="/blog"
          className="text-sm font-semibold text-accent-deep hover:underline"
        >
          Все новости →
        </Link>
      </div>

      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {posts.slice(0, 4).map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex w-[min(78vw,18rem)] shrink-0 flex-col overflow-hidden rounded-[1.35rem] border border-line bg-bg-elevated shadow-[var(--card-shadow)] transition hover:border-accent/40 sm:w-auto"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-bg-soft">
              <Cover src={post.coverImageUrl} title={post.title} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              {post.publishedAt ? (
                <time
                  dateTime={post.publishedAt}
                  className="text-[11px] text-ink-muted"
                >
                  {formatRuDate(post.publishedAt)}
                </time>
              ) : null}
              <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-ink sm:text-[15px]">
                {post.title}
              </h3>
              <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
                {(post.excerpt || post.body || "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 110)}
                …
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
