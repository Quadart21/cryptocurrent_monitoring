import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getLegalSettings } from "@/lib/store";
import { renderBlogMarkdown } from "@/lib/news/markdown";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const legal = await getLegalSettings();
  return {
    title: legal.cookieTitle || "Политика cookies",
    description: "Какие cookies использует GapSnap и как управлять согласием.",
  };
}

export default async function CookiesPage() {
  const legal = await getLegalSettings();
  const updated = legal.cookieUpdatedAt
    ? new Date(legal.cookieUpdatedAt)
    : null;

  return (
    <article className="prose-gap mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { label: "Cookies" },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold text-ink">
        {legal.cookieTitle}
      </h1>
      {updated && Number.isFinite(updated.getTime()) ? (
        <p className="text-sm text-ink-muted">
          Редакция от{" "}
          {updated.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      ) : null}
      <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
        {renderBlogMarkdown(legal.cookieBody)}
      </div>
    </article>
  );
}
