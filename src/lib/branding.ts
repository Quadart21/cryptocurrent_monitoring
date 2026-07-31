import {
  sanitizeSvgDetailed,
  svgSanitizeErrorMessage,
} from "@/lib/sanitize-svg";
import {
  clearSiteAssetData,
  setSiteAssetData,
  syncSeoUrlsFromBranding,
} from "@/lib/store";
import type {
  SiteAssetFormat,
  SiteAssetKind,
  SiteAssetMeta,
} from "@/lib/branding-url";

export {
  SITE_ASSET_KINDS,
  isSiteAssetKind,
  brandingPublicUrl,
  siteAssetLabel,
  siteAssetHint,
  siteAssetAccept,
  DEFAULT_BRAND_LOGO_PATH,
  type SiteAssetFormat,
  type SiteAssetKind,
  type SiteAssetMeta,
} from "@/lib/branding-url";

export const BRANDING_MAX_BYTES = 3 * 1024 * 1024;
export const BRANDING_LOGO_MAX_BYTES = 1024 * 1024;
/** Branding SVGs from Figma/Illustrator are far larger than achievement icons. */
const BRANDING_SVG_MAX_CHARS = 3_500_000;

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ICO_SIG = [0x00, 0x00, 0x01, 0x00];

function isPng(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  return PNG_SIG.every((b, i) => buf[i] === b);
}

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isWebp(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  return (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

function isIco(buf: Buffer): boolean {
  if (buf.length < 6) return false;
  return ICO_SIG.every((b, i) => buf[i] === b);
}

function looksLikeSvg(buf: Buffer, name: string, type: string): boolean {
  if (type.includes("svg") || name.endsWith(".svg")) return true;
  const head = decodeSvgText(buf).slice(0, 512).trimStart();
  return (
    head.startsWith("<svg") ||
    (head.startsWith("<?xml") && head.toLowerCase().includes("<svg"))
  );
}

function decodeSvgText(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString("utf16le");
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buf);
  }
  // Strip UTF-8 BOM if present
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString("utf8", 3);
  }
  return buf.toString("utf8");
}

function sanitizeBrandingSvg(buf: Buffer): string {
  const result = sanitizeSvgDetailed(decodeSvgText(buf), {
    maxLength: BRANDING_SVG_MAX_CHARS,
    allowStyle: true,
    allowDataImages: true,
  });
  if (!result.ok) {
    throw new Error(svgSanitizeErrorMessage(result.reason));
  }
  return result.svg;
}

async function toPngSquare(buf: Buffer, size: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buf)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function prepareRaster(
  buf: Buffer,
  opts?: { maxWidth?: number; square?: number },
): Promise<{ format: SiteAssetFormat; bytes: Buffer }> {
  const sharp = (await import("sharp")).default;
  let pipeline = sharp(buf, { failOn: "none" });
  if (opts?.square) {
    pipeline = pipeline.resize(opts.square, opts.square, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  } else if (opts?.maxWidth) {
    pipeline = pipeline.resize({
      width: opts.maxWidth,
      withoutEnlargement: true,
    });
  }
  const bytes = await pipeline.png().toBuffer();
  return { format: "png", bytes };
}

export async function validateAndPrepareSiteAsset(
  kind: SiteAssetKind,
  file: File | null | undefined,
): Promise<{ format: SiteAssetFormat; bytes: Buffer }> {
  if (!file || file.size === 0) {
    throw new Error("Выберите файл");
  }

  const max =
    kind === "logo" ? BRANDING_LOGO_MAX_BYTES : BRANDING_MAX_BYTES;
  if (file.size > max) {
    throw new Error(
      kind === "logo"
        ? "Логотип слишком большой (макс. 1 МБ)"
        : "Файл слишком большой (макс. 3 МБ)",
    );
  }

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (kind === "favicon") {
    if (isIco(buf) || name.endsWith(".ico") || type.includes("icon")) {
      if (!isIco(buf)) {
        throw new Error("Файл должен быть настоящим .ico");
      }
      return { format: "ico", bytes: buf };
    }
    if (looksLikeSvg(buf, name, type)) {
      const svg = sanitizeBrandingSvg(buf);
      const sharp = (await import("sharp")).default;
      const png = await sharp(Buffer.from(svg, "utf8"), { density: 150 })
        .resize(32, 32, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      return { format: "png", bytes: png };
    }
    if (isPng(buf) || isJpeg(buf) || isWebp(buf)) {
      return { format: "png", bytes: await toPngSquare(buf, 32) };
    }
    throw new Error("Favicon: .ico, PNG, JPEG, WebP или SVG");
  }

  if (kind === "logo") {
    if (looksLikeSvg(buf, name, type)) {
      const svg = sanitizeBrandingSvg(buf);
      return { format: "svg", bytes: Buffer.from(svg, "utf8") };
    }
    if (isPng(buf) || type === "image/png" || name.endsWith(".png")) {
      if (!isPng(buf)) throw new Error("Файл должен быть настоящим PNG");
      return { format: "png", bytes: buf };
    }
    if (isJpeg(buf) || isWebp(buf)) {
      return prepareRaster(buf, { maxWidth: 1024 });
    }
    throw new Error("Логотип: SVG, PNG, JPEG или WebP");
  }

  if (kind === "icon" || kind === "apple_icon") {
    const size = kind === "icon" ? 32 : 180;
    if (looksLikeSvg(buf, name, type)) {
      const svg = sanitizeBrandingSvg(buf);
      const sharp = (await import("sharp")).default;
      const bytes = await sharp(Buffer.from(svg, "utf8"), { density: 150 })
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      return { format: "png", bytes };
    }
    if (isPng(buf) || isJpeg(buf) || isWebp(buf)) {
      return { format: "png", bytes: await toPngSquare(buf, size) };
    }
    throw new Error("Иконка: PNG, JPEG, WebP или SVG");
  }

  // og_image
  if (looksLikeSvg(buf, name, type)) {
    const svg = sanitizeBrandingSvg(buf);
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(Buffer.from(svg, "utf8"), { density: 150 })
      .resize({ width: 1200, withoutEnlargement: true })
      .png()
      .toBuffer();
    return { format: "png", bytes };
  }
  if (isPng(buf)) {
    return prepareRaster(buf, { maxWidth: 1600 });
  }
  if (isJpeg(buf)) {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(buf)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { format: "jpeg", bytes };
  }
  if (isWebp(buf)) {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(buf)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { format: "webp", bytes };
  }
  throw new Error("OG-изображение: PNG, JPEG, WebP или SVG");
}

export async function saveSiteAsset(
  kind: SiteAssetKind,
  prepared: { format: SiteAssetFormat; bytes: Buffer },
): Promise<SiteAssetMeta> {
  const meta = await setSiteAssetData(kind, prepared);
  await syncSeoUrlsFromBranding();
  return meta;
}

export async function deleteSiteAsset(kind: SiteAssetKind): Promise<void> {
  await clearSiteAssetData(kind);
  await syncSeoUrlsFromBranding();
}
