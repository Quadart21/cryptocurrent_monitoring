import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getLegalSettings } from "@/lib/store";
import { renderBlogMarkdown } from "@/lib/news/markdown";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const legal = await getLegalSettings();
  return {
    title: legal.termsTitle || "Условия использования",
    description:
      "Условия использования платформы GapSnap: доступ к мониторингу курсов, кабинетам и связанным сервисам.",
  };
}

export default async function TermsPage() {
  const legal = await getLegalSettings();
  const updated = legal.termsUpdatedAt
    ? new Date(legal.termsUpdatedAt)
    : null;

  return (
    <article className="prose-gap mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { label: "Условия использования" },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold text-ink">
        {legal.termsTitle}
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
        {renderBlogMarkdown(legal.termsBody)}
      </div>
    </article>
  );
}
