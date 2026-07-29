import Link from "next/link";
import type { BlogPost } from "@/lib/store";

function formatRuDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function HomeNewsStrip({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null;

  const items = posts.slice(0, 3);

  return (
    <section className="border-t border-line/40 pt-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-ink-muted">Новости</span>
        <span className="hidden text-ink-muted/40 sm:inline" aria-hidden>
          ·
        </span>
        <ul className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
          {items.map((post) => (
            <li key={post.id} className="min-w-0">
              <Link
                href={`/blog/${post.slug}`}
                className="group inline-flex max-w-full items-baseline gap-2 text-sm text-ink-muted transition hover:text-accent"
              >
                {post.publishedAt ? (
                  <time
                    dateTime={post.publishedAt}
                    className="shrink-0 text-[11px] tabular-nums text-ink-muted/70"
                  >
                    {formatRuDate(post.publishedAt)}
                  </time>
                ) : null}
                <span className="truncate group-hover:underline">
                  {post.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/blog"
          className="shrink-0 text-xs font-medium text-ink-muted transition hover:text-accent"
        >
          Все →
        </Link>
      </div>
    </section>
  );
}
