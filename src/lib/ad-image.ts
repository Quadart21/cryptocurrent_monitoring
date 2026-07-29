import {
  clearAdImageData,
  setAdImageData,
} from "@/lib/store";
import type { AdImageMeta } from "@/lib/ad-image-url";

export const AD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type AdImageFormat = AdImageMeta["format"];

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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

export async function validateAndPrepareAdImage(
  file: File | null | undefined,
): Promise<{ format: AdImageFormat; bytes: Buffer } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > AD_IMAGE_MAX_BYTES) {
    throw new Error("Картинка слишком большая (макс. 2 МБ)");
  }

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (type === "image/png" || name.endsWith(".png") || isPng(buf)) {
    if (!isPng(buf)) throw new Error("Файл должен быть настоящим PNG");
    return { format: "png", bytes: buf };
  }

  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    isJpeg(buf)
  ) {
    if (!isJpeg(buf)) throw new Error("Файл должен быть настоящим JPEG");
    return { format: "jpeg", bytes: buf };
  }

  if (type === "image/webp" || name.endsWith(".webp") || isWebp(buf)) {
    if (!isWebp(buf)) throw new Error("Файл должен быть настоящим WebP");
    return { format: "webp", bytes: buf };
  }

  throw new Error("Баннер: только JPG, PNG или WebP");
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
export type { AdImageMeta } from "@/lib/ad-image-url";
