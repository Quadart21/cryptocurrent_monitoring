import "server-only";

import type { Metadata } from "next";
import { getSeoSettings } from "@/lib/store";
import type { SeoSettings } from "@/lib/store-types";

export function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

export function absoluteUrl(siteUrl: string, pathOrUrl: string): string | null {
  const raw = pathOrUrl.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return null;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

export function parseKeywords(keywords: string): string[] {
  return keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function parseNoindexPaths(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function buildRootMetadata(seo: SeoSettings): Metadata {
  const siteUrl = normalizeSiteUrl(seo.siteUrl);
  const ogImage = absoluteUrl(seo.siteUrl, seo.ogImageUrl);
  const keywords = parseKeywords(seo.keywords);
  const robotsExtra = seo.robotsExtra
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const verification: NonNullable<Metadata["verification"]> = {};
  if (seo.googleVerification.trim()) {
    verification.google = seo.googleVerification.trim();
  }
  if (seo.yandexVerification.trim()) {
    verification.yandex = seo.yandexVerification.trim();
  }
  if (seo.bingVerification.trim()) {
    verification.other = {
      ...(verification.other ?? {}),
      "msvalidate.01": seo.bingVerification.trim(),
    };
  }

  const ogTitle = seo.ogTitle.trim() || seo.titleDefault;
  const ogDescription = seo.ogDescription.trim() || seo.description;

  const robotsBase = `${seo.robotsIndex ? "index" : "noindex"}, ${
    seo.robotsFollow ? "follow" : "nofollow"
  }`;

  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: {
      default: seo.titleDefault,
      template: seo.titleTemplate.includes("%s")
        ? seo.titleTemplate
        : `%s · ${seo.siteName}`,
    },
    description: seo.description,
    keywords: keywords.length ? keywords : undefined,
    applicationName: seo.siteName || undefined,
    robots: robotsExtra.length
      ? `${robotsBase}, ${robotsExtra.join(", ")}`
      : {
          index: seo.robotsIndex,
          follow: seo.robotsFollow,
          googleBot: {
            index: seo.robotsIndex,
            follow: seo.robotsFollow,
          },
        },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName: seo.siteName || undefined,
      title: ogTitle,
      description: ogDescription,
      url: siteUrl || undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: seo.twitterCard,
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [ogImage] : undefined,
      site: seo.twitterHandle.trim()
        ? seo.twitterHandle.startsWith("@")
          ? seo.twitterHandle.trim()
          : `@${seo.twitterHandle.trim()}`
        : undefined,
    },
    verification:
      Object.keys(verification).length > 0 ? verification : undefined,
    alternates: siteUrl
      ? {
          canonical: "/",
        }
      : undefined,
  };
}

export async function getRootMetadata(): Promise<Metadata> {
  return buildRootMetadata(await getSeoSettings());
}

export function buildOrganizationJsonLd(seo: SeoSettings): object | null {
  if (!seo.jsonLdEnabled) return null;
  const siteUrl = normalizeSiteUrl(seo.siteUrl);
  const name = seo.organizationName.trim() || seo.siteName.trim();
  if (!name && !siteUrl) return null;

  const logo = absoluteUrl(seo.siteUrl, seo.organizationLogoUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: name || undefined,
    url: siteUrl || undefined,
    logo: logo || undefined,
    description: seo.description || undefined,
  };
}

export async function getOrganizationJsonLd(): Promise<object | null> {
  return buildOrganizationJsonLd(await getSeoSettings());
}

export function buildRobotsTxt(seo: SeoSettings): string {
  const siteUrl = normalizeSiteUrl(seo.siteUrl);
  const lines: string[] = ["User-agent: *"];

  if (!seo.robotsIndex) {
    lines.push("Disallow: /");
  } else {
    lines.push("Allow: /");
    for (const path of parseNoindexPaths(seo.noindexPaths)) {
      lines.push(`Disallow: ${path.startsWith("/") ? path : `/${path}`}`);
    }
    // Always hide admin/cabinet APIs from crawlers
    for (const path of ["/trulala", "/cabinet", "/api/"]) {
      if (!parseNoindexPaths(seo.noindexPaths).includes(path)) {
        lines.push(`Disallow: ${path}`);
      }
    }
  }

  const extra = seo.robotsTxtExtra
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());
  if (extra.length) {
    lines.push("");
    lines.push(...extra);
  }

  if (seo.sitemapEnabled && siteUrl) {
    lines.push("");
    lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  }

  return `${lines.join("\n")}\n`;
}
