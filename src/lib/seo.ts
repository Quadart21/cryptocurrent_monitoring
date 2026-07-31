import "server-only";

import type { Metadata } from "next";
import {
  ADMIN_INTERNAL_PATH,
  ADMIN_PATH,
} from "@/lib/admin-auth";
import { brandingPublicUrl } from "@/lib/branding-url";
import { getSeoSettings, listSiteAssetMeta } from "@/lib/store";
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

/**
 * Canonical site origin: SEO settings → SITE_URL env → request Host.
 * Empty siteUrl in admin was producing a blank /sitemap.xml.
 */
export async function resolveSiteUrl(seoSiteUrl?: string): Promise<string> {
  const fromSeo = normalizeSiteUrl(seoSiteUrl ?? "");
  if (fromSeo) return fromSeo;

  const fromEnv = normalizeSiteUrl(process.env.SITE_URL ?? "");
  if (fromEnv) return fromEnv;

  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "")
      .split(",")[0]
      ?.trim();
    if (!host) return "";
    const proto = (
      h.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https")
    )
      .split(",")[0]
      ?.trim();
    return normalizeSiteUrl(`${proto}://${host}`);
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
  const siteUrl =
    normalizeSiteUrl(seo.siteUrl) ||
    normalizeSiteUrl(process.env.SITE_URL ?? "");
  const ogImage = absoluteUrl(seo.siteUrl || process.env.SITE_URL || "", seo.ogImageUrl);
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
  const [seo, assets] = await Promise.all([
    getSeoSettings(),
    listSiteAssetMeta(),
  ]);
  const base = buildRootMetadata(seo);
  const byKind = new Map(assets.map((a) => [a.kind, a]));

  const iconMeta = byKind.get("icon");
  const appleMeta = byKind.get("apple_icon");
  const faviconMeta = byKind.get("favicon");

  const iconUrl =
    brandingPublicUrl("icon", iconMeta) ?? "/api/branding/icon";
  const appleUrl =
    brandingPublicUrl("apple_icon", appleMeta) ?? "/api/branding/apple_icon";
  const icoUrl = brandingPublicUrl("favicon", faviconMeta);

  const iconEntries: Array<{ url: string; type?: string }> = [];
  if (icoUrl) {
    iconEntries.push({ url: icoUrl, type: "image/x-icon" });
  }
  iconEntries.push({ url: iconUrl, type: "image/png" });

  return {
    ...base,
    icons: {
      icon: iconEntries,
      apple: [{ url: appleUrl, type: "image/png" }],
    },
  };
}

export function buildOrganizationJsonLd(seo: SeoSettings): object | null {
  if (!seo.jsonLdEnabled) return null;
  const siteUrl =
    normalizeSiteUrl(seo.siteUrl) ||
    normalizeSiteUrl(process.env.SITE_URL ?? "");
  const name = seo.organizationName.trim() || seo.siteName.trim();
  if (!name && !siteUrl) return null;

  const logo = absoluteUrl(
    seo.siteUrl || process.env.SITE_URL || "",
    seo.organizationLogoUrl,
  );
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
  const siteUrl =
    normalizeSiteUrl(seo.siteUrl) ||
    normalizeSiteUrl(process.env.SITE_URL ?? "");
  const lines: string[] = ["User-agent: *"];

  // Never advertise the admin URL in robots.txt — Disallow reveals the path.
  // Admin pages already send robots:noindex / X-Robots-Tag.
  const secretPrefixes = [ADMIN_PATH, ADMIN_INTERNAL_PATH]
    .map((p) => p.toLowerCase())
    .filter(Boolean);

  function isSecretPath(path: string): boolean {
    const p = path.toLowerCase();
    return secretPrefixes.some(
      (secret) => p === secret || p.startsWith(`${secret}/`),
    );
  }

  if (!seo.robotsIndex) {
    lines.push("Disallow: /");
  } else {
    lines.push("Allow: /");
    for (const path of parseNoindexPaths(seo.noindexPaths)) {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      if (isSecretPath(normalized)) continue;
      lines.push(`Disallow: ${normalized}`);
    }
    // Technical API only — do not list admin panels here
    if (
      !parseNoindexPaths(seo.noindexPaths).some(
        (p) => (p.startsWith("/") ? p : `/${p}`) === "/api/",
      )
    ) {
      lines.push("Disallow: /api/");
    }
  }

  const extra = seo.robotsTxtExtra
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());
  if (extra.length) {
    lines.push("");
    for (const line of extra) {
      const disallowMatch = line.match(/^Disallow:\s*(\S+)/i);
      if (disallowMatch && isSecretPath(disallowMatch[1])) continue;
      lines.push(line);
    }
  }

  if (seo.sitemapEnabled && siteUrl) {
    lines.push("");
    lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  }

  return `${lines.join("\n")}\n`;
}
