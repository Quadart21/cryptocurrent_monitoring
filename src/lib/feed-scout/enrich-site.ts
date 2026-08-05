import "server-only";

import { pngHasTransparency } from "@/lib/logo";
import { sanitizeAchievementSvg } from "@/lib/sanitize-svg";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";
import { normalizeTelegramHandle } from "@/lib/site-contacts";
import { exchangerNameFromFeedUrl } from "@/lib/feed-scout/normalize";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2_000_000;
const MAX_LOGO_BYTES = 512 * 1024;
const MAX_PAGES = 4;

const CONTACT_PATHS = [
  "/contacts",
  "/contact",
  "/support",
  "/about",
  "/help",
  "/feedback",
  "/en/contacts",
  "/en/contact",
  "/ru/contacts",
  "/ru/contact",
  "/page/contacts",
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TG_LINK_RE =
  /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{4,32})(?:\?[^\s"'<>]*)?/gi;
const TG_AT_RE =
  /(?:telegram|телеграм|tg|поддержк\w*|support|contact)[^@\n]{0,40}@([A-Za-z0-9_]{4,32})/gi;

const EMAIL_JUNK_HOSTS = new Set([
  "example.com",
  "example.org",
  "sentry.io",
  "wixpress.com",
  "cloudflare.com",
  "schema.org",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "facebook.com",
  "github.com",
  "wordpress.com",
  "wordpress.org",
  "jquery.com",
  "w3.org",
  "sentry-next.wixpress.com",
]);

const TG_JUNK = new Set([
  "share",
  "joinchat",
  "addstickers",
  "proxy",
  "socks",
  "iv",
  "s",
  "c",
  "login",
  "setlanguage",
]);

export type SiteEnrichment = {
  name: string;
  website: string;
  contact: string;
  description: string;
  ownerEmail: string | null;
  emails: string[];
  telegrams: string[];
  pagesFetched: number;
  logo: { format: "svg" | "png"; bytes: Buffer } | null;
};

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = Number.parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}

function metaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      "i",
    );
    const m = html.match(re);
    const value = (m?.[1] || m?.[2] || "").trim();
    if (value) return decodeEntities(value);
  }
  return "";
}

function titleFromHtml(html: string): string {
  const ogSite = metaContent(html, ["og:site_name"]);
  if (ogSite) return cleanName(ogSite);

  const appName = metaContent(html, ["application-name"]);
  if (appName) return cleanName(appName);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) return cleanName(decodeEntities(titleMatch[1]));

  const ogTitle = metaContent(html, ["og:title"]);
  if (ogTitle) return cleanName(ogTitle);

  return "";
}

function cleanName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").trim();
  name = name
    .replace(
      /\s*[|\-–—:]\s*(обмен|exchange|bestchange|купить|crypto).*$/i,
      "",
    )
    .replace(/\s*[|\-–—]\s*.{0,40}$/i, (tail) =>
      /обмен|exchange|crypto|валют|bitcoin|btc/i.test(tail) ? "" : tail,
    )
    .trim();
  if (name.length < 2 || name.length > 80) {
    return raw.replace(/\s+/g, " ").trim().slice(0, 80);
  }
  return name;
}

function registrableDomain(host: string): string {
  const h = host.replace(/^www\./i, "").toLowerCase();
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join(".");
  // crude ccTLD handling: co.uk etc. — keep last 2 for most cases
  if (/^(co|com|net|org|gov|ac)\.[a-z]{2}$/i.test(last2) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 1) return true;
  const local = lower.slice(0, at);
  const host = lower.slice(at + 1);
  if (EMAIL_JUNK_HOSTS.has(host)) return true;
  for (const junk of EMAIL_JUNK_HOSTS) {
    if (host === junk || host.endsWith(`.${junk}`)) return true;
  }
  if (
    /\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(local) ||
    local.includes("noreply") ||
    local.includes("no-reply") ||
    local.includes("mailer-daemon") ||
    local === "webpack" ||
    local === "sentry"
  ) {
    return true;
  }
  return false;
}

function scoreEmail(email: string, siteDomain: string): number {
  const lower = email.toLowerCase();
  const at = lower.lastIndexOf("@");
  const local = lower.slice(0, at);
  const host = lower.slice(at + 1);
  let score = 1;
  if (host === siteDomain || host.endsWith(`.${siteDomain}`)) score += 10;
  if (/^(support|info|admin|contact|help|office|mail|hello|sales)$/i.test(local)) {
    score += 5;
  }
  if (/^(abuse|postmaster|webmaster|privacy)$/i.test(local)) score -= 2;
  return score;
}

function extractEmails(html: string, siteDomain: string): string[] {
  const found = html.match(EMAIL_RE) ?? [];
  const scored = new Map<string, number>();
  for (const raw of found) {
    const email = raw.toLowerCase();
    if (isJunkEmail(email)) continue;
    const prev = scored.get(email) ?? -Infinity;
    const next = scoreEmail(email, siteDomain);
    if (next > prev) scored.set(email, next);
  }
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e)
    .slice(0, 5);
}

function extractTelegrams(html: string): string[] {
  const handles = new Set<string>();
  for (const re of [TG_LINK_RE, TG_AT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const handle = normalizeTelegramHandle(m[1] ?? "");
      if (!handle || TG_JUNK.has(handle.toLowerCase())) continue;
      if (/^\d+$/.test(handle)) continue;
      handles.add(handle);
    }
  }
  return [...handles].slice(0, 5);
}

function contactPathsFromHtml(html: string, origin: string): string[] {
  const hrefRe = /href=["']([^"']+)["']/gi;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = (m[1] || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }
    if (!/contact|support|about|feedback|help|связ|поддерж/i.test(href)) continue;
    try {
      const abs = new URL(href, origin);
      if (abs.origin !== new URL(origin).origin) continue;
      const key = `${abs.pathname}${abs.search}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(abs.toString());
    } catch {
      /* ignore */
    }
  }
  return out.slice(0, 4);
}

function logoCandidates(html: string, origin: string): string[] {
  const urls: string[] = [];
  const push = (raw: string) => {
    try {
      const abs = new URL(raw, origin).toString();
      if (!urls.includes(abs)) urls.push(abs);
    } catch {
      /* ignore */
    }
  };

  const iconRe =
    /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = iconRe.exec(html)) !== null) {
    const tag = m[0];
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) push(href);
  }

  const ogImage = metaContent(html, ["og:image"]);
  if (ogImage) push(ogImage);

  push("/favicon.svg");
  push("/favicon.png");
  push("/apple-touch-icon.png");
  return urls.slice(0, 6);
}

async function fetchHtml(url: string): Promise<string> {
  let current = await assertSafeOutboundUrl(url, { allowHttp: true });

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (compatible; GapSnapFeedScout/1.0; +https://gapsnap.org)",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) throw new Error("Редирект без Location");
        if (hop === MAX_REDIRECTS) throw new Error("Слишком много редиректов");
        const next = new URL(location, current);
        current = await assertSafeOutboundUrl(next.toString(), {
          allowHttp: true,
        });
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const lengthHeader = res.headers.get("content-length");
      if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
        throw new Error("Страница слишком большая");
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BODY_BYTES) throw new Error("Страница слишком большая");
      return buf.toString("utf8");
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Не удалось загрузить сайт");
}

async function fetchBinary(url: string): Promise<Buffer | null> {
  try {
    let current = await assertSafeOutboundUrl(url, { allowHttp: true });
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(current.toString(), {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            Accept: "image/svg+xml,image/png,image/*;q=0.8,*/*;q=0.5",
            "User-Agent":
              "Mozilla/5.0 (compatible; GapSnapFeedScout/1.0; +https://gapsnap.org)",
          },
          cache: "no-store",
        });

        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get("location");
          if (!location || hop === MAX_REDIRECTS) return null;
          current = await assertSafeOutboundUrl(
            new URL(location, current).toString(),
            { allowHttp: true },
          );
          continue;
        }

        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > MAX_LOGO_BYTES) return null;
        return buf;
      } finally {
        clearTimeout(timer);
      }
    }
  } catch {
    return null;
  }
  return null;
}

function prepareLogoFromBuffer(
  buf: Buffer,
  urlHint: string,
): { format: "svg" | "png"; bytes: Buffer } | null {
  const lower = urlHint.toLowerCase();
  const head = buf.toString("utf8", 0, Math.min(buf.length, 256));
  const looksSvg =
    lower.includes(".svg") ||
    head.includes("<svg") ||
    head.trimStart().startsWith("<?xml");

  if (looksSvg) {
    const svg = sanitizeAchievementSvg(buf.toString("utf8"));
    if (!svg) return null;
    return { format: "svg", bytes: Buffer.from(svg, "utf8") };
  }

  if (pngHasTransparency(buf)) {
    return { format: "png", bytes: buf };
  }
  return null;
}

function buildContact(emails: string[], telegrams: string[]): string {
  const parts: string[] = [];
  if (emails[0]) parts.push(emails[0]);
  if (telegrams[0]) parts.push(`@${telegrams[0]}`);
  return parts.join(" · ");
}

function buildDescription(metaDescription: string): string {
  const base = "Добавлен через feed-scout бота. На модерации.";
  const meta = metaDescription.replace(/\s+/g, " ").trim().slice(0, 280);
  if (!meta) return base;
  return `${meta}\n\n${base}`;
}

/**
 * Fetch exchanger website (origin of feed URL) and enrich card fields:
 * name, contact (email/Telegram), description, optional logo.
 */
export async function enrichExchangerFromFeedUrl(
  feedUrl: string,
): Promise<SiteEnrichment> {
  const fallback = exchangerNameFromFeedUrl(feedUrl);
  const empty: SiteEnrichment = {
    name: fallback.name,
    website: fallback.website,
    contact: "",
    description: "Добавлен через feed-scout бота. На модерации.",
    ownerEmail: null,
    emails: [],
    telegrams: [],
    pagesFetched: 0,
    logo: null,
  };

  if (!fallback.website) return empty;

  let origin: string;
  let siteDomain: string;
  try {
    const u = new URL(fallback.website);
    origin = `${u.protocol}//${u.host}`;
    siteDomain = registrableDomain(u.hostname);
  } catch {
    return empty;
  }

  const pageUrls: string[] = [origin + "/"];
  for (const path of CONTACT_PATHS) {
    pageUrls.push(origin + path);
  }

  const htmlParts: string[] = [];
  let pagesFetched = 0;
  let bestName = "";
  let metaDescription = "";
  let logoUrlHints: string[] = [];

  // Homepage first (needed for link discovery + title).
  try {
    const homeHtml = await fetchHtml(origin + "/");
    pagesFetched += 1;
    htmlParts.push(homeHtml);
    bestName = titleFromHtml(homeHtml);
    metaDescription =
      metaContent(homeHtml, ["description", "og:description"]) || "";
    logoUrlHints = logoCandidates(homeHtml, origin);

    for (const discovered of contactPathsFromHtml(homeHtml, origin)) {
      if (!pageUrls.includes(discovered)) pageUrls.push(discovered);
    }
  } catch {
    // Homepage failed — still try a couple of contact paths.
  }

  const remainingSlots = Math.max(0, MAX_PAGES - pagesFetched);
  const rest = pageUrls
    .filter((u) => u !== `${origin}/` && u !== origin)
    .slice(0, remainingSlots + 3);
  for (const url of rest) {
    if (pagesFetched >= MAX_PAGES) break;
    try {
      const html = await fetchHtml(url);
      pagesFetched += 1;
      htmlParts.push(html);
      if (!bestName) bestName = titleFromHtml(html);
      if (!metaDescription) {
        metaDescription =
          metaContent(html, ["description", "og:description"]) || "";
      }
    } catch {
      /* skip page */
    }
  }

  const combined = htmlParts.join("\n");
  const emails = extractEmails(combined, siteDomain);
  const telegrams = extractTelegrams(combined);
  const contact = buildContact(emails, telegrams);
  const name = bestName || fallback.name;

  let logo: SiteEnrichment["logo"] = null;
  for (const hint of logoUrlHints) {
    const buf = await fetchBinary(hint);
    if (!buf) continue;
    logo = prepareLogoFromBuffer(buf, hint);
    if (logo) break;
  }

  return {
    name,
    website: fallback.website,
    contact,
    description: buildDescription(metaDescription),
    ownerEmail: emails[0] ?? null,
    emails,
    telegrams,
    pagesFetched,
    logo,
  };
}
