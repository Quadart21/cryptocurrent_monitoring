import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { ShareButtons } from "@/components/seo/ShareButtons";
import { renderBlogMarkdown } from "@/lib/news/markdown";
import { absoluteUrl } from "@/lib/seo";
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo-jsonld";
import { getBlogPostBySlug, getSeoSettings } from "@/lib/store";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug, { publishedOnly: true });
  if (!post) return { title: "Новость" };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || post.title;
  return { title, description };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, seo] = await Promise.all([
    getBlogPostBySlug(slug, { publishedOnly: true }),
    getSeoSettings(),
  ]);
  if (!post) notFound();

  const path = `/blog/${post.slug}`;
  const description = post.seoDescription || post.excerpt || post.title;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <JsonLd
        data={[
          buildBreadcrumbJsonLd(seo, [
            { name: "Главная", path: "/" },
            { name: "Новости", path: "/blog" },
            { name: post.title, path },
          ]),
          buildBlogPostingJsonLd({
            seo,
            title: post.title,
            description,
            urlPath: path,
            authorName: post.authorName,
            publishedAt: post.publishedAt,
            updatedAt: post.updatedAt,
            imageUrl: post.coverImageUrl || null,
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { href: "/blog", label: "Новости" },
          { label: post.title },
        ]}
      />
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold text-ink">
          {post.title}
        </h1>
        <p className="text-sm text-ink-muted">
          {post.authorName || "GapSnap"}
          {post.publishedAt
            ? ` · ${new Date(post.publishedAt).toLocaleDateString("ru-RU")}`
            : ""}
        </p>
        {post.tags.length ? (
          <p className="flex flex-wrap gap-2 text-xs text-ink-muted">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </p>
        ) : null}
        <ShareButtons
          title={post.title}
          url={absoluteUrl(seo.siteUrl, path) ?? undefined}
        />
      </header>
      {post.coverImageUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-bg-elevated">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      {renderBlogMarkdown(post.body)}
    </article>
  );
}
