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

function formatRuDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
    <article className="mx-auto max-w-3xl space-y-8">
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

      <header className="animate-rise space-y-4">
        {post.tags.length ? (
          <p className="flex flex-wrap gap-2">
            {post.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-deep"
              >
                {tag}
              </span>
            ))}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
        <p className="text-sm text-ink-muted">
          {post.authorName || "GapSnap"}
          {post.publishedAt ? ` · ${formatRuDate(post.publishedAt)}` : ""}
        </p>
        {post.excerpt ? (
          <p className="text-base leading-relaxed text-ink-muted sm:text-lg">
            {post.excerpt}
          </p>
        ) : null}
        <ShareButtons
          title={post.title}
          url={absoluteUrl(seo.siteUrl, path) ?? undefined}
        />
      </header>

      {post.coverImageUrl ? (
        <div className="animate-rise-delay-1 relative aspect-[16/9] overflow-hidden rounded-[1.5rem] border border-line bg-bg-elevated shadow-[var(--card-shadow)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="animate-rise-delay-2 prose-blog space-y-4 text-[15px] leading-7 text-ink sm:text-base sm:leading-8">
        {renderBlogMarkdown(post.body)}
      </div>
    </article>
  );
}
