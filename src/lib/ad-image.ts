import {
  clearAdImageData,
  setAdImageData,
} from "@/lib/store";
import type { AdImageFormat, AdImageMeta } from "@/lib/ad-image-url";
import { isAdVideoFormat } from "@/lib/ad-image-url";

/** Static / animated images */
export const AD_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
/** Short MP4 / WebM loops */
export const AD_VIDEO_MAX_BYTES = 8 * 1024 * 1024;

export type { AdImageFormat, AdImageMeta };

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBM_SIG = [0x1a, 0x45, 0xdf, 0xa3];

function isPng(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  return PNG_SIG.every((b, i) => buf[i] === b);
}

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isGif(buf: Buffer): boolean {
  if (buf.length < 6) return false;
  const head = buf.toString("ascii", 0, 6);
  return head === "GIF87a" || head === "GIF89a";
}

function isWebp(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  return (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

function isIsoBmff(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp";
}

function isoBrandBlob(buf: Buffer): string {
  return buf.toString("ascii", 0, Math.min(buf.length, 96)).toLowerCase();
}

function isAvif(buf: Buffer): boolean {
  if (!isIsoBmff(buf)) return false;
  const brands = isoBrandBlob(buf);
  return brands.includes("avif") || brands.includes("avis");
}

function isMp4(buf: Buffer): boolean {
  if (!isIsoBmff(buf)) return false;
  if (isAvif(buf)) return false;
  const brands = isoBrandBlob(buf);
  // Reject still-image HEIF containers.
  if (
    (brands.includes("heic") || brands.includes("heif")) &&
    !brands.includes("mp4") &&
    !brands.includes("isom") &&
    !brands.includes("iso2") &&
    !brands.includes("avc1")
  ) {
    return false;
  }
  return true;
}

function isWebm(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return WEBM_SIG.every((b, i) => buf[i] === b);
}

function maxBytesFor(format: AdImageFormat): number {
  return isAdVideoFormat(format) ? AD_VIDEO_MAX_BYTES : AD_IMAGE_MAX_BYTES;
}

export async function validateAndPrepareAdImage(
  file: File | null | undefined,
): Promise<{ format: AdImageFormat; bytes: Buffer } | null> {
  if (!file || file.size === 0) return null;

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let format: AdImageFormat | null = null;

  if (type === "image/png" || name.endsWith(".png") || isPng(buf)) {
    if (!isPng(buf)) throw new Error("Файл должен быть настоящим PNG");
    format = "png";
  } else if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    isJpeg(buf)
  ) {
    if (!isJpeg(buf)) throw new Error("Файл должен быть настоящим JPEG");
    format = "jpeg";
  } else if (type === "image/webp" || name.endsWith(".webp") || isWebp(buf)) {
    if (!isWebp(buf)) throw new Error("Файл должен быть настоящим WebP");
    format = "webp";
  } else if (type === "image/gif" || name.endsWith(".gif") || isGif(buf)) {
    if (!isGif(buf)) throw new Error("Файл должен быть настоящим GIF");
    format = "gif";
  } else if (type === "image/avif" || name.endsWith(".avif") || isAvif(buf)) {
    if (!isAvif(buf)) throw new Error("Файл должен быть настоящим AVIF");
    format = "avif";
  } else if (
    type === "video/mp4" ||
    type === "video/quicktime" ||
    name.endsWith(".mp4") ||
    name.endsWith(".m4v") ||
    (isMp4(buf) && !name.endsWith(".avif"))
  ) {
    if (!isMp4(buf)) throw new Error("Файл должен быть настоящим MP4");
    format = "mp4";
  } else if (
    type === "video/webm" ||
    name.endsWith(".webm") ||
    isWebm(buf)
  ) {
    if (!isWebm(buf)) throw new Error("Файл должен быть настоящим WebM");
    format = "webm";
  }

  if (!format) {
    throw new Error(
      "Баннер: JPG, PNG, WebP, AVIF, GIF или короткое видео MP4/WebM",
    );
  }

  const max = maxBytesFor(format);
  if (file.size > max) {
    const label = isAdVideoFormat(format) ? "8 МБ" : "3 МБ";
    throw new Error(
      isAdVideoFormat(format)
        ? `Видео слишком большое (макс. ${label})`
        : `Файл слишком большой (макс. ${label})`,
    );
  }

  return { format, bytes: buf };
}

export async function saveAdImage(
  adId: string,
  prepared: { format: AdImageFormat; bytes: Buffer },
): Promise<AdImageMeta> {
  return setAdImageData(adId, prepared);
}

export async function deleteAdImage(adId: string): Promise<void> {
  await clearAdImageData(adId);
}

export { adImagePublicUrl } from "@/lib/ad-image-url";
