import Link from "next/link";
import type { BlogPost } from "@/lib/store";

function formatRuDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

/** Quiet footnote-style links under homepage SEO — not a featured section. */
export function HomeNewsStrip({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null;

  const items = posts.slice(0, 2);

  return (
    <section
      aria-label="Новости"
      className="border-t border-line/25 pt-4 text-[11px] leading-relaxed text-ink-muted/75"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="shrink-0 text-ink-muted/55">Новости</span>
        {items.map((post) => (
          <span key={post.id} className="inline-flex min-w-0 max-w-full items-baseline gap-1.5">
            <span className="text-ink-muted/35" aria-hidden>
              ·
            </span>
            <Link
              href={`/blog/${post.slug}`}
              className="min-w-0 truncate transition hover:text-ink-muted hover:underline"
            >
              {post.publishedAt ? (
                <time
                  dateTime={post.publishedAt}
                  className="mr-1.5 tabular-nums text-ink-muted/50"
                >
                  {formatRuDate(post.publishedAt)}
                </time>
              ) : null}
              {post.title}
            </Link>
          </span>
        ))}
        <span className="text-ink-muted/35" aria-hidden>
          ·
        </span>
        <Link
          href="/blog"
          className="shrink-0 text-ink-muted/55 transition hover:text-ink-muted hover:underline"
        >
          все
        </Link>
      </div>
    </section>
  );
}
