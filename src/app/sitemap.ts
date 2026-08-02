import type { MetadataRoute } from "next";
import { pairPath } from "@/lib/bestchange/pair-slug";
import { resolveSiteUrl } from "@/lib/seo";
import {
  listActiveRatePairs,
  listBlogPosts,
  listExchangers,
  getSeoSettings,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSeoSettings();
  if (!seo.sitemapEnabled) return [];

  const siteUrl = await resolveSiteUrl(seo.siteUrl);
  if (!siteUrl) {
    console.error(
      "[gapsnap] sitemap: siteUrl пуст — задайте SEO → URL сайта или SITE_URL в .env",
    );
    return [];
  }

  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "hourly", priority: 1 },
    {
      url: `${siteUrl}/exchangers`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/advertise`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/apply`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/partners`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/blacklist`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/offer`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  try {
    const [exchangers, pairs, posts] = await Promise.all([
      listExchangers({ publicOnly: true }),
      listActiveRatePairs(500),
      listBlogPosts({ status: "published" }),
    ]);

    const exchangerRoutes: MetadataRoute.Sitemap = exchangers
      .filter((ex) => ex.status === "active" && ex.slug)
      .map((ex) => ({
        url: `${siteUrl}/exchangers/${ex.slug}`,
        lastModified: ex.lastSyncAt ? new Date(ex.lastSyncAt) : now,
        changeFrequency: "hourly" as const,
        priority: 0.8,
      }));

    const pairRoutes: MetadataRoute.Sitemap = pairs.map(([from, to]) => ({
      url: `${siteUrl}${pairPath(from, to)}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.85,
    }));

    const blogRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    }));

    return [...staticRoutes, ...pairRoutes, ...exchangerRoutes, ...blogRoutes];
  } catch (err) {
    console.error("[gapsnap] sitemap: failed to load dynamic URLs", err);
    // Still return static routes so crawlers get something useful
    return staticRoutes;
  }
}
