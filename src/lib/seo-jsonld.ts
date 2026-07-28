import { absoluteUrl, normalizeSiteUrl } from "@/lib/seo";
import type { SeoSettings } from "@/lib/store-types";

export type BreadcrumbItem = { name: string; path: string };

export function buildWebSiteJsonLd(seo: SeoSettings): object | null {
  if (!seo.jsonLdEnabled) return null;
  const siteUrl = normalizeSiteUrl(seo.siteUrl);
  if (!siteUrl) return null;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seo.siteName || "GapSnap",
    url: siteUrl,
    description: seo.description || undefined,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?from={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbJsonLd(
  seo: SeoSettings,
  items: BreadcrumbItem[],
): object | null {
  if (!seo.jsonLdEnabled || !items.length) return null;
  const siteUrl = normalizeSiteUrl(seo.siteUrl);
  if (!siteUrl) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(seo.siteUrl, item.path) ?? undefined,
    })),
  };
}

export function buildFaqJsonLd(
  seo: SeoSettings,
  faqs: Array<{ q: string; a: string }>,
): object | null {
  if (!seo.jsonLdEnabled || !faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

export function buildAggregateRatingJsonLd(input: {
  seo: SeoSettings;
  name: string;
  urlPath: string;
  description?: string;
  rating: number;
  reviewCount: number;
}): object | null {
  if (!input.seo.jsonLdEnabled) return null;
  if (!input.reviewCount || input.rating <= 0) return null;
  const url = absoluteUrl(input.seo.siteUrl, input.urlPath);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description || undefined,
    url: url || undefined,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(input.rating.toFixed(2)),
      bestRating: 5,
      worstRating: 1,
      ratingCount: input.reviewCount,
      reviewCount: input.reviewCount,
    },
  };
}

export function buildPairProductJsonLd(input: {
  seo: SeoSettings;
  name: string;
  description: string;
  urlPath: string;
  bestRate: number | null;
  currency: string;
  offerCount: number;
}): object | null {
  if (!input.seo.jsonLdEnabled) return null;
  const url = absoluteUrl(input.seo.siteUrl, input.urlPath);
  const offers =
    input.offerCount > 0 && input.bestRate != null
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "RUB",
          lowPrice: String(input.bestRate),
          offerCount: input.offerCount,
          availability: "https://schema.org/InStock",
        }
      : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    url: url || undefined,
    category: "CurrencyExchange",
    offers,
  };
}
