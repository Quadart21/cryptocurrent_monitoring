export const AD_IMAGE_FORMATS = [
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "mp4",
  "webm",
] as const;

export type AdImageFormat = (typeof AD_IMAGE_FORMATS)[number];

export type AdImageMeta = {
  format: AdImageFormat;
  updatedAt: string;
};

export const AD_VIDEO_FORMATS: ReadonlySet<AdImageFormat> = new Set([
  "mp4",
  "webm",
]);

export function isAdVideoFormat(
  format: string | null | undefined,
): format is "mp4" | "webm" {
  return format === "mp4" || format === "webm";
}

export function isAdImageFormat(value: string | null | undefined): value is AdImageFormat {
  return (
    value === "jpeg" ||
    value === "png" ||
    value === "webp" ||
    value === "gif" ||
    value === "avif" ||
    value === "mp4" ||
    value === "webm"
  );
}

export const AD_MEDIA_CONTENT_TYPES: Record<AdImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** Heuristic for external media URLs (no stored format). */
export function guessAdMediaFormatFromUrl(
  url: string,
): AdImageFormat | null {
  const clean = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  if (clean.endsWith(".mp4")) return "mp4";
  if (clean.endsWith(".webm")) return "webm";
  if (clean.endsWith(".gif")) return "gif";
  if (clean.endsWith(".avif")) return "avif";
  if (clean.endsWith(".webp")) return "webp";
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "jpeg";
  return null;
}

export function adMediaIsVideo(input: {
  format?: string | null;
  url?: string | null;
}): boolean {
  if (isAdVideoFormat(input.format)) return true;
  if (input.url) {
    const guessed = guessAdMediaFormatFromUrl(input.url);
    return isAdVideoFormat(guessed);
  }
  return false;
}

export function adImagePublicUrl(
  adId: string,
  image: AdImageMeta | null | undefined,
): string | null {
  if (!image) return null;
  return `/api/ad-images/${encodeURIComponent(adId)}?v=${encodeURIComponent(image.updatedAt)}`;
}
