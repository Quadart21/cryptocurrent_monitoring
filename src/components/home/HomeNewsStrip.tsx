"use client";

import Link from "next/link";
import type { BlogPost } from "@/lib/store-types";

function formatRuDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

type NewsItem = Pick<BlogPost, "id" | "slug" | "title" | "publishedAt">;

function NewsSegment({
  posts,
  keyPrefix,
}: {
  posts: NewsItem[];
  keyPrefix: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-8 pr-8 sm:gap-10 sm:pr-10">
      {posts.map((post, i) => (
        <Link
          key={`${keyPrefix}-${post.id}-${i}`}
          href={`/blog/${post.slug}`}
          className="inline-flex max-w-[min(80vw,28rem)] shrink-0 items-baseline gap-2 whitespace-nowrap text-sm text-ink transition hover:text-accent sm:max-w-none sm:text-base"
        >
          {post.publishedAt ? (
            <time
              dateTime={post.publishedAt}
              className="shrink-0 tabular-nums text-ink-muted"
            >
              {formatRuDate(post.publishedAt)}
            </time>
          ) : null}
          <span className="truncate font-medium">{post.title}</span>
        </Link>
      ))}
      <Link
        key={`${keyPrefix}-all`}
        href="/blog"
        className="shrink-0 whitespace-nowrap text-sm font-semibold text-accent hover:underline sm:text-base"
      >
        Все новости →
      </Link>
    </div>
  );
}

/** Homepage news marquee under SEO content. */
export function HomeNewsStrip({ posts }: { posts: NewsItem[] }) {
  if (!posts.length) return null;

  const items = posts.slice(0, 10);
  const loop =
    items.length === 1 ? [...items, ...items, ...items] : items;

  return (
    <section
      aria-label="Новости"
      className="relative min-h-[48px] overflow-hidden border-t border-line bg-bg-soft/40"
    >
      <p className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-md bg-bg-elevated px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted shadow-sm sm:text-[11px]">
        Новости
      </p>
      <div className="ad-ticker-track py-3 pl-[4.75rem] sm:pl-24">
        <NewsSegment posts={loop} keyPrefix="a" />
        <NewsSegment posts={loop} keyPrefix="b" />
      </div>
    </section>
  );
}
