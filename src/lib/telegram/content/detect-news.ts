import "server-only";

import { listBlogPosts } from "@/lib/store";
import type { NewsPayload } from "@/lib/telegram/content/types";

export type NewsCandidate = NewsPayload & {
  dedupeKey: string;
};

const LOOKBACK_MS = 48 * 60 * 60 * 1000;

/**
 * Recently published blog posts that can be mirrored to the Telegram channel.
 */
export async function findNewsCandidates(input?: {
  limit?: number;
  lookbackMs?: number;
}): Promise<NewsCandidate[]> {
  const limit = Math.min(20, Math.max(1, input?.limit ?? 8));
  const lookback = input?.lookbackMs ?? LOOKBACK_MS;
  const cutoff = Date.now() - lookback;
  const posts = await listBlogPosts({ status: "published" });
  const out: NewsCandidate[] = [];

  for (const p of posts) {
    if (out.length >= limit) break;
    const when = Date.parse(p.publishedAt || p.createdAt);
    if (!Number.isFinite(when) || when < cutoff) continue;
    if (!p.slug.trim() || !p.title.trim()) continue;
    out.push({
      blogId: p.id,
      slug: p.slug,
      title: p.title.slice(0, 120),
      excerpt: p.excerpt || "",
      coverImageUrl: p.coverImageUrl || "",
      blogPath: `/blog/${p.slug}`,
      dedupeKey: `news:${p.id}`,
    });
  }

  return out;
}

/** Single-post enqueue helper after news sync creates an article. */
export function newsCandidateFromBlog(post: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string;
}): NewsCandidate | null {
  if (!post.id || !post.slug.trim() || !post.title.trim()) return null;
  return {
    blogId: post.id,
    slug: post.slug,
    title: post.title.slice(0, 120),
    excerpt: post.excerpt || "",
    coverImageUrl: post.coverImageUrl || "",
    blogPath: `/blog/${post.slug}`,
    dedupeKey: `news:${post.id}`,
  };
}
