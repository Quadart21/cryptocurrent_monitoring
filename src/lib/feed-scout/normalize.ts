import "server-only";

/** Normalize a feed URL for uniqueness checks across workers. */
export function normalizeFeedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;

  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  let pathname = url.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname;

  return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
}

/** Extract http(s) URLs from free-form Telegram message text. */
export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const raw = m.replace(/[.,;:!?)]+$/g, "").trim();
    const norm = normalizeFeedUrl(raw);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(raw);
  }
  return out;
}

export function exchangerNameFromFeedUrl(feedUrl: string): {
  name: string;
  website: string;
} {
  try {
    const u = new URL(feedUrl.trim());
    const host = u.hostname.replace(/^www\./i, "");
    return {
      name: host || "Feed scout",
      website: `${u.protocol}//${u.host}`,
    };
  } catch {
    return { name: "Feed scout", website: "" };
  }
}
