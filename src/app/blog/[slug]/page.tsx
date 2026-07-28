import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { ShareButtons } from "@/components/seo/ShareButtons";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbJsonLd } from "@/lib/seo-jsonld";
import { getBlogPostBySlug, getSeoSettings } from "@/lib/store";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug, { publishedOnly: true });
  if (!post) return { title: "Статья" };
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
  const paragraphs = post.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <JsonLd
        data={buildBreadcrumbJsonLd(seo, [
          { name: "Главная", path: "/" },
          { name: "Блог", path: "/blog" },
          { name: post.title, path },
        ])}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { href: "/blog", label: "Блог" },
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
        <ShareButtons
          title={post.title}
          url={absoluteUrl(seo.siteUrl, path) ?? undefined}
        />
      </header>
      <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
        {paragraphs.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </article>
  );
}
