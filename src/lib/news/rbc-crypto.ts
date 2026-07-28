import { XMLParser } from "fast-xml-parser";

/** Official RBC Crypto RSS (30 latest, with full-text). */
export const RBC_CRYPTO_RSS_URL =
  "https://rssexport.rbc.ru/crypto/news/30/full.rss";

export type RbcCryptoNewsItem = {
  id: string;
  title: string;
  link: string;
  /** Short teaser (~announcement). */
  anons: string;
  /**
   * Body from `rbc_news:full-text`.
   * Usually the article text; RBC often appends related-title lines
   * and may truncate the field mid-sentence.
   */
  fullText: string;
  /** `fullText` with trailing related-title block stripped when detected. */
  bodyText: string;
  /** Whether `fullText` looks cut off (no terminal punctuation). */
  fullTextTruncated: boolean;
  category: string;
  author: string;
  tags: string[];
  publishedAt: Date | null;
  imageUrl: string | null;
  type: string;
};

export type RbcCryptoFeed = {
  title: string;
  link: string;
  ttlMinutes: number | null;
  fetchedAt: Date;
  items: RbcCryptoNewsItem[];
};

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 3_000_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  cdataPropName: "__cdata",
  isArray: (name) =>
    name === "item" ||
    name === "enclosure" ||
    name === "rbc_news:tag" ||
    name === "rbc_news:image",
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "__cdata" in value) {
    return String((value as { __cdata: unknown }).__cdata ?? "").trim();
  }
  return String(value).trim();
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function normalizeText(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * RBC appends related article titles after the body, often truncated.
 * Heuristic: drop trailing short title-like paragraphs.
 */
export function stripRelatedFooter(fullText: string): string {
  const parts = fullText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return fullText;

  const looksLikeRelatedTitle = (block: string): boolean => {
    if (block.includes("\n") || block.length > 160 || block.length < 20) {
      return false;
    }
    // Truncated mid-word / mid-phrase (RBC cuts the field)
    if (!/[.!?…»")\]]$/.test(block) && block.length <= 130) return true;

    // "Headline. Short teaser" pattern used in related links
    if (/^.{15,100}\.\s+[А-ЯA-Z«"].{5,70}$/.test(block)) return true;

    const sentenceEnds = (block.match(/[.!?…]/g) ?? []).length;
    if (sentenceEnds === 0) return true;
    if (sentenceEnds === 1 && block.endsWith("?") && block.length <= 130) {
      return true;
    }
    return false;
  };

  let cut = parts.length;
  while (cut > 1 && looksLikeRelatedTitle(parts[cut - 1]!)) {
    cut -= 1;
  }

  return parts.slice(0, cut).join("\n\n").trim();
}

function looksTruncated(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // Clean ending or ends with related title that got cut mid-word
  if (/[.!?…»")\]]$/.test(t)) return false;
  if (/[а-яa-z]$/i.test(t) && t.length > 200) return true;
  return !/[.!?…]$/.test(t);
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function firstImageUrl(item: Record<string, unknown>): string | null {
  const enclosure = asArray(item.enclosure)[0] as
    | { "@_url"?: string }
    | undefined;
  if (enclosure?.["@_url"]) return String(enclosure["@_url"]);

  const images = asArray(item["rbc_news:image"]) as Array<
    Record<string, unknown>
  >;
  for (const img of images) {
    const url = textOf(img["rbc_news:url"] ?? img.url);
    if (url) return url;
  }
  return null;
}

/**
 * Parse RBC Crypto RSS XML (`full.rss`).
 * Throws if the document is not a valid RSS channel with items.
 */
export function parseRbcCryptoRss(xml: string): Omit<RbcCryptoFeed, "fetchedAt"> {
  if (!xml.includes("<rss") && !xml.includes("<RSS")) {
    throw new Error("Ответ не похож на RSS");
  }

  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) {
    throw new Error("Некорректный RSS: нет <channel>");
  }

  const rawItems = asArray(channel.item) as Array<Record<string, unknown>>;
  if (!rawItems.length) {
    throw new Error("В RSS нет элементов <item>");
  }

  const items: RbcCryptoNewsItem[] = rawItems.map((raw) => {
    const guidRaw =
      typeof raw.guid === "object" && raw.guid !== null
        ? (raw.guid as { "#text"?: unknown; __cdata?: unknown })["#text"] ??
          (raw.guid as { __cdata?: unknown }).__cdata
        : raw.guid;

    const id =
      textOf(raw["rbc_news:news_id"]) || textOf(guidRaw) || textOf(raw.link);

    const anons = normalizeText(
      textOf(raw["rbc_news:anons"]) || textOf(raw.description),
    );
    const fullText = normalizeText(textOf(raw["rbc_news:full-text"]));
    const bodyText = stripRelatedFooter(fullText);

    return {
      id,
      title: normalizeText(textOf(raw.title)),
      link: textOf(raw.link) || textOf(raw.pdalink),
      anons,
      fullText,
      bodyText,
      fullTextTruncated: looksTruncated(fullText),
      category: textOf(raw.category),
      author: textOf(raw.author),
      tags: asArray(raw["rbc_news:tag"]).map(textOf).filter(Boolean),
      publishedAt: parseDate(textOf(raw.pubDate)),
      imageUrl: firstImageUrl(raw),
      type: textOf(raw["rbc_news:type"]) || "article",
    };
  });

  const ttlRaw = textOf(channel.ttl);
  const ttl = ttlRaw ? Number(ttlRaw) : NaN;

  return {
    title: textOf(channel.title) || "РБК Крипто",
    link: textOf(channel.link) || "https://www.rbc.ru/crypto/",
    ttlMinutes: Number.isFinite(ttl) ? ttl : null,
    items,
  };
}

/** Fetch and parse the live RBC Crypto RSS feed. */
export async function fetchRbcCryptoNews(
  url: string = RBC_CRYPTO_RSS_URL,
): Promise<RbcCryptoFeed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "GapSnapNews/1.0 (+https://gapsnap.local)",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} при запросе RBC Crypto RSS`);
    }

    const lengthHeader = res.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
      throw new Error("RSS слишком большой");
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BODY_BYTES) {
      throw new Error("RSS слишком большой");
    }

    const parsed = parseRbcCryptoRss(buf.toString("utf8"));
    return { ...parsed, fetchedAt: new Date() };
  } finally {
    clearTimeout(timer);
  }
}
