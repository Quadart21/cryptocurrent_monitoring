import type { MetadataRoute } from "next";
import { listExchangers, getSeoSettings } from "@/lib/store";
import { normalizeSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSeoSettings();
  if (!seo.sitemapEnabled) return [];

  const siteUrl = normalizeSiteUrl(seo.siteUrl);
  if (!siteUrl) return [];

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
      url: `${siteUrl}/blacklist`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  const exchangers = await listExchangers({ publicOnly: true });
  const exchangerRoutes: MetadataRoute.Sitemap = exchangers
    .filter((ex) => ex.status === "active" && ex.slug)
    .map((ex) => ({
      url: `${siteUrl}/exchangers/${ex.slug}`,
      lastModified: ex.lastSyncAt ? new Date(ex.lastSyncAt) : now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    }));

  return [...staticRoutes, ...exchangerRoutes];
}
