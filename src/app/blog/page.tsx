import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { listBlogPosts } from "@/lib/store";

export const metadata: Metadata = {
  title: "Новости",
  description:
    "Новости крипторынка и материалы о выборе обменников, курсах и безопасности обмена.",
};
export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await listBlogPosts({ status: "published" });

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Главная" }, { label: "Новости" }]}
      />
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Новости
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Обзор событий крипторынка с акцентом на обмен, курсы и безопасность —
          в контексте мониторинга GapSnap.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">
          Скоро здесь появятся материалы. Загляните позже.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="card block space-y-2 p-5 hover:border-accent/40"
            >
              <h2 className="font-display text-lg font-semibold text-ink">
                {p.title}
              </h2>
              <p className="line-clamp-3 text-sm text-ink-muted">
                {p.excerpt || p.body.slice(0, 160)}
              </p>
              <p className="text-xs text-ink-muted">
                {p.publishedAt
                  ? new Date(p.publishedAt).toLocaleDateString("ru-RU")
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
