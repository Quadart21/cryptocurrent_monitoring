/**
 * Fetch logos/favicons from exchanger websites and store in Postgres.
 *
 * Usage (on app host with .env):
 *   node scripts/fetch-exchanger-logos.mjs           # dry-run
 *   node scripts/fetch-exchanger-logos.mjs --apply
 *   node scripts/fetch-exchanger-logos.mjs --apply --limit=20
 *   node scripts/fetch-exchanger-logos.mjs --apply --only=kubex,crypik
 */
import "dotenv/config";
import { Pool } from "pg";
import sharp from "sharp";

const MAX_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const CONCURRENCY = 4;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const limitArg = [...args].find((a) => a.startsWith("--limit="));
const onlyArg = [...args].find((a) => a.startsWith("--only="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) || 0 : 0;
const ONLY = onlyArg
  ? new Set(
      onlyArg
        .split("=")[1]
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    )
  : null;

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(buf) {
  return buf.length >= 8 && PNG_SIG.equals(buf.subarray(0, 8));
}

function pngHasTransparency(buf) {
  if (!isPng(buf) || buf.length < 33) return false;
  const colorType = buf[25];
  if (colorType === 4 || colorType === 6) return true;
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "tRNS") return true;
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return false;
}

function looksSvg(buf, contentType = "", url = "") {
  const head = buf.toString("utf8", 0, Math.min(buf.length, 512)).toLowerCase();
  return (
    contentType.includes("svg") ||
    url.toLowerCase().includes(".svg") ||
    head.includes("<svg")
  );
}

/** Extract largest embedded PNG from a Windows ICO (sharp often cannot decode BMP-ICO). */
function extractPngFromIco(buf) {
  if (buf.length < 6) return null;
  const type = buf.readUInt16LE(2);
  const count = buf.readUInt16LE(4);
  if (type !== 1 || count < 1 || count > 64) return null;
  let best = null;
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > buf.length) break;
    const w = buf[entry] || 256;
    const h = buf[entry + 1] || 256;
    const size = buf.readUInt32LE(entry + 8);
    const offset = buf.readUInt32LE(entry + 12);
    if (offset + size > buf.length) continue;
    const slice = buf.subarray(offset, offset + size);
    if (!isPng(slice)) continue;
    const area = w * h;
    if (!best || area > best.area) best = { area, slice: Buffer.from(slice) };
  }
  return best?.slice || null;
}

/**
 * Decode largest 32-bpp BMP image inside an ICO into raw RGBA.
 * ICO DIBs store height as XOR+AND and pixels bottom-up BGRA.
 */
function decodeBmpIcoToRgba(buf) {
  if (buf.length < 6) return null;
  const type = buf.readUInt16LE(2);
  const count = buf.readUInt16LE(4);
  if (type !== 1 || count < 1 || count > 64) return null;
  let best = null;
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > buf.length) break;
    const size = buf.readUInt32LE(entry + 8);
    const offset = buf.readUInt32LE(entry + 12);
    if (offset + size > buf.length || size < 40) continue;
    const dib = buf.subarray(offset, offset + size);
    const headerSize = dib.readUInt32LE(0);
    if (headerSize < 40) continue;
    const width = Math.abs(dib.readInt32LE(4));
    let height = Math.abs(dib.readInt32LE(8));
    // XOR + AND mask
    if (height === (buf[entry + 1] || 256) * 2 || height > (buf[entry + 1] || 256)) {
      height = Math.floor(height / 2);
    }
    const bitCount = dib.readUInt16LE(14);
    if (bitCount !== 32 || width < 1 || height < 1 || width > 512 || height > 512) {
      continue;
    }
    const rowSize = width * 4;
    const need = headerSize + rowSize * height;
    if (dib.length < need) continue;
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const srcOff = headerSize + srcY * rowSize;
      for (let x = 0; x < width; x++) {
        const s = srcOff + x * 4;
        const d = (y * width + x) * 4;
        rgba[d] = dib[s + 2];
        rgba[d + 1] = dib[s + 1];
        rgba[d + 2] = dib[s];
        rgba[d + 3] = dib[s + 3];
      }
    }
    const area = width * height;
    if (!best || area > best.area) best = { area, width, height, rgba };
  }
  return best;
}

function sanitizeSvg(text) {
  if (!text || text.length > 100_000) return null;
  if (!/<svg[\s>]/i.test(text)) return null;
  if (/<script[\s>]/i.test(text)) return null;
  let svg = text
    .replace(
      /<\/?(?:script|foreignObject|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|style)\b[^>]*>/gi,
      "",
    )
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+(?:href|xlink:href|src|action|formaction)\s*=\s*("|')\s*(?:javascript|data|vbscript)\s*:/gi,
      " data-blocked=",
    )
    .replace(/javascript:/gi, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  if (!/<svg[\s>]/i.test(svg)) return null;
  return svg.trim();
}

function absolutize(base, href) {
  if (!href) return null;
  const h = href.trim().replace(/^['"]|['"]$/g, "");
  if (!h || h.startsWith("data:") || h.startsWith("blob:") || h === "#") return null;
  try {
    return new URL(h, base).href;
  } catch {
    return null;
  }
}

function extractCandidates(html, pageUrl) {
  const found = [];
  const push = (url, score, reason) => {
    if (!url) return;
    found.push({ url, score, reason });
  };

  const linkRe =
    /<link\b[^>]*\brel\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    const rel = m[1].toLowerCase();
    const hrefM = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    const typeM = /\btype\s*=\s*["']([^"']+)["']/i.exec(tag);
    const sizesM = /\bsizes\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!hrefM) continue;
    const href = absolutize(pageUrl, hrefM[1]);
    const type = (typeM?.[1] || "").toLowerCase();
    const sizes = sizesM?.[1] || "";
    const sizeNum = /(\d+)/.exec(sizes);
    const dim = sizeNum ? Number(sizeNum[1]) : 0;

    if (rel.includes("apple-touch-icon")) {
      push(href, 70 + Math.min(dim, 180) / 10, "apple-touch-icon");
    } else if (rel.includes("icon")) {
      let score = 50;
      if (type.includes("svg") || href?.includes(".svg")) score = 95;
      else if (type.includes("png") || href?.includes(".png")) score = 80;
      else if (href?.includes(".ico")) score = 40;
      score += Math.min(dim, 256) / 20;
      push(href, score, `icon:${rel}`);
    }
  }

  const metaRe =
    /<meta\b[^>]*\b(?:property|name)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = metaRe.exec(html))) {
    const tag = m[0];
    const prop = m[1].toLowerCase();
    if (
      prop !== "og:image" &&
      prop !== "og:image:url" &&
      prop !== "twitter:image" &&
      prop !== "twitter:image:src"
    ) {
      continue;
    }
    const contentM = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!contentM) continue;
    const href = absolutize(pageUrl, contentM[1]);
    let score = 45;
    if (href?.includes(".svg")) score = 90;
    else if (href?.includes(".png")) score = 60;
    push(href, score, prop);
  }

  // JSON-LD logo
  const ldRe =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html))) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const logo = node?.logo;
        const url =
          typeof logo === "string"
            ? logo
            : logo?.url || node?.image?.url || node?.image;
        if (typeof url === "string") {
          push(absolutize(pageUrl, url), 75, "json-ld");
        }
      }
    } catch {
      /* ignore */
    }
  }

  // <img src="...logo..."> heuristics
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = imgRe.exec(html))) {
    const src = m[1];
    const tag = m[0].toLowerCase();
    const srcLow = src.toLowerCase();
    if (
      srcLow.includes("logo") ||
      tag.includes("logo") ||
      tag.includes('alt="logo') ||
      tag.includes("alt='logo")
    ) {
      let score = 72;
      if (srcLow.includes(".svg")) score = 91;
      else if (srcLow.includes(".png")) score = 76;
      push(absolutize(pageUrl, src), score, "img-logo");
    }
  }

  const origin = new URL(pageUrl).origin;
  const common = [
    ["/favicon.svg", 92],
    ["/logo.svg", 93],
    ["/images/logo.svg", 88],
    ["/img/logo.svg", 88],
    ["/assets/logo.svg", 88],
    ["/static/logo.svg", 85],
    ["/favicon.png", 72],
    ["/logo.png", 78],
    ["/images/logo.png", 70],
    ["/img/logo.png", 70],
    ["/apple-touch-icon.png", 68],
    ["/apple-touch-icon-precomposed.png", 65],
    ["/favicon.ico", 35],
  ];
  for (const [path, score] of common) {
    push(`${origin}${path}`, score, `common:${path}`);
  }

  // Dedupe by URL, keep highest score
  const byUrl = new Map();
  for (const c of found) {
    const prev = byUrl.get(c.url);
    if (!prev || c.score > prev.score) byUrl.set(c.url, c);
  }
  return [...byUrl.values()].sort((a, b) => b.score - a.score);
}

async function fetchBuffer(url, { accept } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept || "*/*",
      },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const ab = await res.arrayBuffer();
    if (!ab.byteLength || ab.byteLength > MAX_BYTES * 3) return null;
    return {
      buf: Buffer.from(ab),
      contentType: ct,
      finalUrl: res.url || url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function prepareLogo(buf, contentType, url) {
  if (looksSvg(buf, contentType, url)) {
    const svg = sanitizeSvg(buf.toString("utf8"));
    if (svg && Buffer.byteLength(svg, "utf8") <= MAX_BYTES) {
      return { format: "svg", bytes: Buffer.from(svg, "utf8"), source: "svg" };
    }
  }

  const icoPng = extractPngFromIco(buf);
  if (icoPng) {
    if (pngHasTransparency(icoPng) && icoPng.length <= MAX_BYTES) {
      return { format: "png", bytes: icoPng, source: "ico-png" };
    }
  }

  const icoRaw = !icoPng ? decodeBmpIcoToRgba(buf) : null;
  if (icoRaw) {
    try {
      const out = await sharp(icoRaw.rgba, {
        raw: { width: icoRaw.width, height: icoRaw.height, channels: 4 },
      })
        .resize(256, 256, {
          fit: "inside",
          withoutEnlargement: false,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .ensureAlpha()
        .png({ compressionLevel: 9 })
        .toBuffer();
      if (out.length <= MAX_BYTES && pngHasTransparency(out)) {
        return { format: "png", bytes: out, source: "ico-bmp" };
      }
    } catch {
      /* fall through */
    }
  }

  const raster = icoPng || buf;

  if (isPng(raster) && pngHasTransparency(raster) && raster.length <= MAX_BYTES) {
    return {
      format: "png",
      bytes: raster,
      source: "png-alpha",
    };
  }

  // Rasterize / convert anything sharp can read into RGBA PNG ≤512KB
  try {
    let out = await sharp(raster, { failOn: "none", animated: false })
      .rotate()
      .resize(256, 256, {
        fit: "inside",
        withoutEnlargement: false,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    if (out.length > MAX_BYTES) {
      out = await sharp(raster, { failOn: "none", animated: false })
        .rotate()
        .resize(128, 128, {
          fit: "inside",
          withoutEnlargement: false,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .ensureAlpha()
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
    if (out.length > MAX_BYTES) return null;
    if (!pngHasTransparency(out)) return null;
    return { format: "png", bytes: out, source: icoPng ? "ico-converted" : "converted" };
  } catch {
    return null;
  }
}

async function resolveLogoForSite(website) {
  let pageUrl;
  try {
    pageUrl = new URL(website).href;
  } catch {
    return { ok: false, error: "bad website" };
  }

  const page = await fetchBuffer(pageUrl, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  });

  const candidates = [];
  if (page?.buf) {
    const html = page.buf.toString("utf8");
    candidates.push(...extractCandidates(html, page.finalUrl || pageUrl));
  }

  let host = "";
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }

  // Third-party fallbacks (lower priority)
  if (host) {
    candidates.push({
      url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      score: 20,
      reason: "google-favicon",
    });
    candidates.push({
      url: `https://icons.duckduckgo.com/ip3/${host}.ico`,
      score: 18,
      reason: "ddg-icon",
    });
  }

  // Prefer higher score; try top N
  const ordered = [...candidates].sort((a, b) => b.score - a.score).slice(0, 18);
  const tried = [];

  for (const c of ordered) {
    const got = await fetchBuffer(c.url);
    if (!got) {
      tried.push({ url: c.url, reason: c.reason, error: "fetch-fail" });
      continue;
    }
    const prepared = await prepareLogo(got.buf, got.contentType, got.finalUrl);
    if (!prepared) {
      tried.push({ url: c.url, reason: c.reason, error: "prepare-fail" });
      continue;
    }
    return {
      ok: true,
      prepared,
      picked: { url: c.url, reason: c.reason, score: c.score },
      tried,
    };
  }

  return { ok: false, error: "no-usable-logo", tried };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(`
  SELECT id, slug, name, website, status
  FROM exchangers
  WHERE logo_data IS NULL
    AND website IS NOT NULL
    AND trim(website) <> ''
  ORDER BY name
`);

let targets = rows.filter((r) => r.status === "active" || r.status === "error");
if (ONLY?.size) {
  targets = targets.filter(
    (r) => ONLY.has(r.slug.toLowerCase()) || ONLY.has(r.name.toLowerCase()),
  );
}
if (LIMIT > 0) targets = targets.slice(0, LIMIT);

console.log(
  JSON.stringify(
    {
      mode: APPLY ? "apply" : "dry-run",
      candidates: targets.length,
      totalMissingWithWebsite: rows.length,
    },
    null,
    2,
  ),
);

const results = await mapPool(targets, CONCURRENCY, async (ex) => {
  const resolved = await resolveLogoForSite(ex.website);
  if (!resolved.ok) {
    return {
      id: ex.id,
      name: ex.name,
      website: ex.website,
      status: "skip",
      error: resolved.error,
    };
  }

  if (APPLY) {
    const updatedAt = new Date().toISOString();
    await pool.query(
      `UPDATE exchangers
       SET logo_format = $2, logo_updated_at = $3, logo_data = $4
       WHERE id = $1`,
      [ex.id, resolved.prepared.format, updatedAt, resolved.prepared.bytes],
    );
  }

  return {
    id: ex.id,
    name: ex.name,
    website: ex.website,
    status: APPLY ? "saved" : "would-save",
    format: resolved.prepared.format,
    bytes: resolved.prepared.bytes.length,
    source: resolved.prepared.source,
    picked: resolved.picked,
  };
});

const saved = results.filter((r) => r.status === "saved" || r.status === "would-save");
const skipped = results.filter((r) => r.status === "skip");

console.log(
  JSON.stringify(
    {
      summary: {
        processed: results.length,
        ok: saved.length,
        skip: skipped.length,
        apply: APPLY,
      },
      saved: saved.map((r) => ({
        name: r.name,
        format: r.format,
        bytes: r.bytes,
        source: r.source,
        from: r.picked?.reason,
        url: r.picked?.url,
      })),
      skipped: skipped.map((r) => ({
        name: r.name,
        website: r.website,
        error: r.error,
      })),
    },
    null,
    2,
  ),
);

await pool.end();
process.exit(skipped.length && !saved.length ? 2 : 0);
