/**
 * Fetch & print RBC Crypto RSS news.
 * Usage: node --experimental-strip-types scripts/fetch-rbc-crypto.mjs
 *    or: npx tsx scripts/fetch-rbc-crypto.mjs
 */
import { XMLParser } from "fast-xml-parser";

const URL = "https://rssexport.rbc.ru/crypto/news/30/full.rss";

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value.__cdata != null) {
    return String(value.__cdata).trim();
  }
  return String(value).trim();
}

function decodeHtmlEntities(input) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/gi, "&");
}

function normalizeText(raw) {
  return decodeHtmlEntities(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripRelatedFooter(fullText) {
  const parts = fullText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return fullText;

  const looksLikeRelatedTitle = (block) => {
    if (block.includes("\n") || block.length > 160 || block.length < 20) {
      return false;
    }
    if (!/[.!?…»")\]]$/.test(block) && block.length <= 130) return true;
    if (/^.{15,100}\.\s+[А-ЯA-Z«"].{5,70}$/.test(block)) return true;
    const sentenceEnds = (block.match(/[.!?…]/g) || []).length;
    if (sentenceEnds === 0) return true;
    if (sentenceEnds === 1 && block.endsWith("?") && block.length <= 130) {
      return true;
    }
    return false;
  };

  let cut = parts.length;
  while (cut > 1 && looksLikeRelatedTitle(parts[cut - 1])) {
    cut -= 1;
  }
  return parts.slice(0, cut).join("\n\n").trim();
}

function looksTruncated(text) {
  const t = text.trim();
  if (!t) return true;
  if (/[.!?…»")\]]$/.test(t)) return false;
  return /[а-яa-z]$/i.test(t) && t.length > 200;
}

const res = await fetch(URL, {
  headers: {
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "User-Agent": "GapSnapNews/1.0",
  },
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const xml = await res.text();

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

const channel = parser.parse(xml).rss.channel;
const items = asArray(channel.item);

console.log(`Источник: ${URL}`);
console.log(`Записей: ${items.length}  |  TTL: ${textOf(channel.ttl)} мин\n`);

let truncatedCount = 0;
let emptyFull = 0;

for (const [i, raw] of items.entries()) {
  const title = normalizeText(textOf(raw.title));
  const anons = normalizeText(
    textOf(raw["rbc_news:anons"]) || textOf(raw.description),
  );
  const fullText = normalizeText(textOf(raw["rbc_news:full-text"]));
  const body = stripRelatedFooter(fullText);
  const truncated = looksTruncated(fullText);
  if (!fullText) emptyFull += 1;
  if (truncated) truncatedCount += 1;

  console.log("─".repeat(72));
  console.log(`#${i + 1}  ${title}`);
  console.log(`id: ${textOf(raw["rbc_news:news_id"])}`);
  console.log(`link: ${textOf(raw.link)}`);
  console.log(`date: ${textOf(raw.pubDate)}`);
  console.log(`tags: ${asArray(raw["rbc_news:tag"]).map(textOf).join(", ")}`);
  console.log(
    `lens: anons=${anons.length}  full=${fullText.length}  body=${body.length}` +
      (truncated ? "  [FULL TRUNCATED]" : ""),
  );
  console.log(`anons: ${anons}`);
  console.log(`body (first 400):\n${body.slice(0, 400)}${body.length > 400 ? "…" : ""}`);
  console.log(`full ends: …${fullText.slice(-120)}`);
}

console.log("\n" + "═".repeat(72));
console.log(
  `Итого: ${items.length} новостей, empty full-text: ${emptyFull}, truncated endings: ${truncatedCount}`,
);
console.log(
  "Вывод: rbc_news:full-text отдаёт тело статьи (часто + хвост похожих заголовков, иногда обрезанный).",
);
